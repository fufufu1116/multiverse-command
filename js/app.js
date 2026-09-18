// MULTIVERSE COMMAND SURFACE - Core Logic v1

const CONFIG = {
    apiBaseUrl: null, 
    mode: "LOCAL_ONLY"
};

const STATE_KEY = "MULTIVERSE_RUNTIME_STATE_V6";

const RuntimeState = {
    data: {
        schema_version: "1.0",
        updated_at: null,
        tasks: [],
        revenues: [],
        settings: {}
    },
    
    load: () => {
        const raw = localStorage.getItem(STATE_KEY);
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
            if (RuntimeState.validate(parsed)) {
                RuntimeState.data = parsed;
            } else {
                console.error("Runtime State validation failed. Fail closed.");
            }
        } catch (e) {
            console.error("Runtime State parse error. Fail closed.");
        }
    },
    
    save: () => {
        RuntimeState.data.updated_at = new Date().toISOString();
        localStorage.setItem(STATE_KEY, JSON.stringify(RuntimeState.data));
        UI.renderAll();
    },

    validate: (state) => {
        if (typeof state !== 'object' || state === null) return false;
        if (state.schema_version !== "1.0") return false;
        if (!Array.isArray(state.tasks)) return false;
        if (!Array.isArray(state.revenues)) return false;
        return true;
    },

    backup: () => {
        localStorage.setItem(`${STATE_KEY}_BACKUP`, localStorage.getItem(STATE_KEY));
    }
};

const Tools = {
    task: {
        add: (title) => {
            if (!title) return;
            RuntimeState.data.tasks.push({
                id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
                title: String(title),
                done: false,
                created_at: new Date().toISOString()
            });
            RuntimeState.save();
            UI.addChat(`【任務】「${title}」を登録しました。`, "system");
        },
        toggle: (id) => {
            const t = RuntimeState.data.tasks.find(x => x.id === id);
            if (t) { t.done = !t.done; RuntimeState.save(); }
        },
        delete: (id) => {
            RuntimeState.data.tasks = RuntimeState.data.tasks.filter(x => x.id !== id);
            RuntimeState.save();
        }
    },
    
    revenue: {
        add: (amountStr) => {
            const val = parseInt(amountStr, 10);
            if (isNaN(val) || !isFinite(val)) {
                UI.addChat("【エラー】不正な収益値です。", "system");
                return;
            }
            RuntimeState.data.revenues.push({
                id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
                amount: val,
                timestamp: new Date().toISOString()
            });
            RuntimeState.save();
            UI.addChat(`【収益】${val > 0 ? '+'+val : val} 円を記録しました。`, "system");
        }
    },

    emperorEye: {
        analyze: () => {
            const revs = RuntimeState.data.revenues.map(r => r.amount);
            if (revs.length < 3) return "観測：データ不足\n傾向：不明\nデータ数：" + revs.length + "\n注意：作戦評価には直近3件のデータが必要です。";
            
            const recent = revs.slice(-3);
            const allPos = recent.every(v => v > 0);
            const allNeg = recent.every(v => v < 0);
            const trendStr = recent.map(v => v>0 ? '+'+v : v).join(" / ");
            
            if (allPos) return `観測：直近3件 [ ${trendStr} ]\n傾向：Positive\nデータ数：${revs.length}\n注意：連続黒字を観測。`;
            if (allNeg) return `観測：直近3件 [ ${trendStr} ]\n傾向：Negative\nデータ数：${revs.length}\n注意：連続損失を観測。ボラティリティに注意。`;
            return `観測：直近3件 [ ${trendStr} ]\n傾向：Mixed\nデータ数：${revs.length}\n注意：収益変動あり。`;
        }
    },

    ev: {
        calculate: () => {
            const odds = parseFloat(document.getElementById('ev-odds').value);
            const winRate = parseFloat(document.getElementById('ev-winrate').value) / 100;
            const bankroll = parseFloat(document.getElementById('ev-bank').value);
            const stake = parseFloat(document.getElementById('ev-stake').value);
            
            const resBox = document.getElementById('ev-result');
            if (isNaN(odds) || isNaN(winRate) || isNaN(bankroll) || isNaN(stake) || odds <= 1 || winRate <= 0) {
                resBox.classList.remove('hidden');
                resBox.style.borderColor = "var(--sys-offline)";
                resBox.textContent = "【エラー】入力値が不正です。";
                return;
            }

            const ev = (winRate * odds) - 1;
            const fullKelly = ((odds - 1) * winRate - (1 - winRate)) / (odds - 1);
            const recStake = bankroll * Math.min(Math.max(0, fullKelly / 2), 0.1);

            let observation = "モデル上期待値プラス";
            let color = "var(--sys-online)";
            if (ev <= 0 || fullKelly <= 0) {
                observation = "モデル上期待値マイナス";
                color = "var(--sys-offline)";
            } else if (stake > recStake) {
                observation = "推奨掛金上限超過";
                color = "var(--sys-warning)";
            }

            resBox.classList.remove('hidden');
            resBox.style.borderColor = color;
            resBox.innerHTML = '';
            const t1 = document.createElement('div'); t1.style.color = color; t1.style.fontWeight = "bold"; t1.textContent = `観測: ${observation}`;
            const t2 = document.createElement('div'); t2.style.marginTop = "6px"; t2.textContent = `期待値(EV): ${(ev*100).toFixed(2)}%`;
            const t3 = document.createElement('div'); t3.textContent = `ハーフケリー: ${(Math.max(0, fullKelly/2)*100).toFixed(2)}%`;
            const t4 = document.createElement('div'); t4.textContent = `推奨掛金上限: ${Math.floor(recStake).toLocaleString()} 円`;
            resBox.append(t1, t2, t3, t4);
            
            UI.addChat(`【参謀】計算完了。モデル観測: [${observation}]`, "system");
        }
    },
    
    exportImport: {
        export: () => {
            const envelope = {
                protocol_version: "1.0",
                schema_version: RuntimeState.data.schema_version,
                exported_at: new Date().toISOString(),
                source: "iphone-runtime",
                state: RuntimeState.data
            };
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(envelope, null, 2));
            const a = document.createElement('a');
            a.href = dataStr;
            a.download = `multiverse_runtime_${Date.now()}.json`;
            a.click();
            UI.addChat("【System】Runtime StateをExportしました。", "system");
        },
        importJSON: (jsonString) => {
            try {
                const parsed = JSON.parse(jsonString);
                if (parsed.protocol_version !== "1.0" || !parsed.state || !RuntimeState.validate(parsed.state)) {
                    alert("無効なフォーマットまたはスキーマ不一致です。(Fail Closed)");
                    return;
                }
                RuntimeState.backup();
                RuntimeState.data = parsed.state;
                RuntimeState.save();
                UI.addChat("【System】データをImportし復旧しました。", "system");
            } catch (e) {
                alert("JSON解析エラー。(Fail Closed)");
            }
        },
        handleFileImport: (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => Tools.exportImport.importJSON(ev.target.result);
            reader.readAsText(file);
        }
    }
};

const TabController = {
    init: () => {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabId = e.currentTarget.getAttribute('data-tab');
                TabController.activate(tabId);
            });
        });
    },
    activate: (tabId) => {
        const targetView = document.getElementById(`view-${tabId}`);
        if (!targetView) return; 
        document.querySelectorAll('.view-container').forEach(v => {
            v.classList.add('hidden');
            v.classList.remove('active');
        });
        targetView.classList.remove('hidden');
        targetView.classList.add('active');

        document.querySelectorAll('.tab-btn').forEach(btn => {
            const isMatch = btn.getAttribute('data-tab') === tabId;
            btn.classList.toggle('active', isMatch);
            btn.setAttribute('aria-selected', isMatch ? "true" : "false");
        });
        window.scrollTo(0, 0);
    }
};

const UI = {
    init: () => {
        RuntimeState.load();
        TabController.init();
        UI.bindEvents();
        UI.renderAll();
        
        window.addEventListener('online', UI.updateStatus);
        window.addEventListener('offline', UI.updateStatus);
        UI.updateStatus();
    },

    bindEvents: () => {
        document.getElementById('btn-send-cmd').addEventListener('click', UI.handleCommand);
        document.getElementById('btn-add-task').addEventListener('click', () => {
            const i = document.getElementById('new-task-input');
            Tools.task.add(i.value.trim()); i.value = '';
        });
        document.getElementById('btn-add-rev').addEventListener('click', () => {
            const i = document.getElementById('new-rev-input');
            Tools.revenue.add(i.value); i.value = '';
        });
        document.getElementById('btn-calc-ev').addEventListener('click', Tools.ev.calculate);
        
        document.getElementById('btn-export').addEventListener('click', Tools.exportImport.export);
        document.getElementById('btn-import-prompt').addEventListener('click', () => {
            document.getElementById('file-import').click();
        });
        document.getElementById('file-import').addEventListener('change', Tools.exportImport.handleFileImport);
    },

    updateStatus: () => {
        const uiStat = document.getElementById('status-ui');
        if (!navigator.onLine) {
            uiStat.textContent = "UI: OFFLINE (Runtime Available)";
            uiStat.className = "sys-badge offline";
        } else {
            uiStat.textContent = "UI: ONLINE (Runtime Available)";
            uiStat.className = "sys-badge online";
        }
    },

    addChat: (msg, type="owner") => {
        const box = document.getElementById('ui-chat-box');
        const div = document.createElement('div');
        div.className = `msg ${type}`;
        div.textContent = msg; 
        box.appendChild(div);
        box.scrollTop = box.scrollHeight;
    },

    handleCommand: () => {
        const input = document.getElementById('cmd-input');
        const msg = input.value.trim();
        if (!msg) return;
        input.value = "";
        UI.addChat(msg, "owner");
        
        if (msg.match(/^タスク追加\s+(.+)/)) {
            Tools.task.add(msg.match(/^タスク追加\s+(.+)/)[1]);
        } else if (msg.match(/^収益\s+(-?\d+)/)) {
            Tools.revenue.add(msg.match(/^収益\s+(-?\d+)/)[1]);
        } else if (msg.match(/^システム状況/)) {
            const t = RuntimeState.data.tasks.length;
            const r = RuntimeState.data.revenues.reduce((s, x) => s + x.amount, 0);
            UI.addChat(`【System】Runtime v6 稼働中。タスク:${t}, 資産:${r}円`, "system");
        } else if (msg.match(/^タブ\s+(本城|部隊|任務|参謀)/)) {
            const map = {"本城":"commander", "部隊":"units", "任務":"tasks", "参謀":"advisor"};
            TabController.activate(map[msg.match(/^タブ\s+(.+)/)[1]]);
        } else {
            UI.addChat(`【System】UNKNOWN_COMMAND. 外部作用は実行されません。(Fail Closed)`, "system");
        }
    },

    renderAll: () => {
        const totalRev = RuntimeState.data.revenues.reduce((s, r) => s + r.amount, 0);
        document.getElementById('ui-total-assets').textContent = totalRev.toLocaleString();
        document.getElementById('ui-emperor-eye').textContent = Tools.emperorEye.analyze();

        const taskList = document.getElementById('ui-tasks-list');
        taskList.innerHTML = '';
        if (RuntimeState.data.tasks.length === 0) {
            taskList.innerHTML = '<div class="data-item">任務なし</div>';
        } else {
            RuntimeState.data.tasks.forEach(t => {
                const d = document.createElement('div');
                d.className = `data-item ${t.done ? 'done' : ''}`;
                
                const c = document.createElement('div');
                c.className = "task-content";
                c.textContent = t.title;

                const a = document.createElement('div');
                a.className = "task-actions";
                
                const toggleBtn = document.createElement('button');
                toggleBtn.textContent = t.done ? "戻す" : "完了";
                toggleBtn.onclick = () => Tools.task.toggle(t.id);
                
                const delBtn = document.createElement('button');
                delBtn.textContent = "削除";
                delBtn.onclick = () => Tools.task.delete(t.id);

                a.append(toggleBtn, delBtn);
                d.append(c, a);
                taskList.appendChild(d);
            });
        }

        const revList = document.getElementById('ui-rev-list');
        revList.innerHTML = '';
        const recentRevs = [...RuntimeState.data.revenues].reverse().slice(0, 5);
        if (recentRevs.length === 0) {
            revList.innerHTML = '<div class="data-item">記録なし</div>';
        } else {
            recentRevs.forEach(r => {
                const d = document.createElement('div');
                d.className = "data-item";
                
                const dateSpan = document.createElement('span');
                dateSpan.style.fontSize = "0.7rem"; dateSpan.style.color = "var(--mv-muted)";
                dateSpan.textContent = new Date(r.timestamp).toLocaleDateString();
                
                const amtSpan = document.createElement('span');
                amtSpan.style.color = r.amount > 0 ? 'var(--sys-online)' : 'var(--sys-offline)';
                amtSpan.textContent = `${r.amount > 0 ? '+'+r.amount : r.amount} 円`;
                
                d.append(dateSpan, amtSpan);
                revList.appendChild(d);
            });
        }

        const avatars = [
            { name: "軍師 (ラファエル)", role: "主席軍師・全体統括", fallback: "🐰" },
            { name: "百人将", role: "事業探索・前線制圧", fallback: "⚔️" },
            { name: "特殊部隊", role: "確率・EV・データ分析", fallback: "🛡️" },
            { name: "システム改善", role: "インフラ・アーキテクチャ", fallback: "⚙️" },
            { name: "AI研究", role: "モデル構築・検証", fallback: "🔬" }
        ];
        const uList = document.getElementById('units-list');
        uList.innerHTML = '';
        avatars.forEach(a => {
            const d = document.createElement('div'); d.className = "data-item"; d.style.justifyContent = "flex-start"; d.style.gap = "16px";
            const f = document.createElement('div'); f.className = "avatar-frame"; f.style.width = "40px"; f.style.height = "40px"; f.style.fontSize = "1.2rem";
            f.textContent = a.fallback;
            const info = document.createElement('div');
            const n = document.createElement('div'); n.style.color = "var(--mv-gold)"; n.style.fontWeight = "bold"; n.textContent = a.name;
            const r = document.createElement('div'); r.style.fontSize = "0.7rem"; r.style.color = "var(--mv-primary)"; r.textContent = a.role;
            info.append(n, r);
            d.append(f, info);
            uList.appendChild(d);
        });
    }
};

window.onload = UI.init;
