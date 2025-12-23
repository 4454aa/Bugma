// js/SaveSystem.js

const SAVE_KEY = "banmen_save_data_v1";

class SaveSystem {
    constructor() {
        this.data = this.loadFromDisk();
    }

    // 从 LocalStorage 读取
    loadFromDisk() {
        try {
            const str = localStorage.getItem(SAVE_KEY);
            if (str) {
                return JSON.parse(str);
            }
        } catch (e) {
            console.error("Save file corrupted or disabled", e);
        }
        // 默认空存档
        return {
            levels: {} // key: levelId, value: { cleared: bool, bestSteps: int, replay: str }
        };
    }

    // 保存到 LocalStorage
    saveToDisk() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.error("Failed to save", e);
        }
    }

    // 提交通关记录
    // logic: 只有步数更少时才更新录像
    submitResult(levelId, steps, replayStr) {
        if (!this.data.levels[levelId]) {
            this.data.levels[levelId] = {
                cleared: true,
                bestSteps: steps,
                replay: replayStr
            };
        } else {
            const record = this.data.levels[levelId];
            // 如果步数更少，或者之前没存录像，则更新
            if (steps < record.bestSteps || !record.replay) {
                record.bestSteps = steps;
                record.replay = replayStr;
            }
            record.cleared = true; // 确保标记为已通关
        }
        this.saveToDisk();
        console.log(`Progress saved for Level ${levelId}. Best: ${this.data.levels[levelId].bestSteps}`);
    }

    // 获取关卡信息 (用于选关界面显示)
    getLevelInfo(levelId) {
        return this.data.levels[levelId] || null;
    }

    // --- [新增] 导出为 JSON 文件 ---
    exportToFile() {
        const exportData = {
            version: 1, // 版本号，方便未来兼容
            timestamp: Date.now(),
            game: "BanmenHTML5",
            content: this.data // 核心数据
        };

        const jsonStr = JSON.stringify(exportData, null, 2); // 美化格式
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        // 创建临时下载链接
        const a = document.createElement('a');
        a.href = url;
        
        // 文件名带时间戳
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        a.download = `banmen_save_${date}.json`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log("Save exported to file.");
    }

    // --- [新增] 从 JSON 文件导入 ---
    // fileInputElement: HTML <input type="file"> 元素
    importFromFile(fileInput, callback) {
        const file = fileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                
                // 简单的格式校验
                if (!imported.content || !imported.content.levels) {
                    alert("错误：存档文件格式不正确！");
                    return;
                }

                // 覆盖当前数据
                this.data = imported.content;
                this.saveToDisk(); // 写入 LocalStorage
                
                console.log("Save imported successfully.");
                alert("存档导入成功！页面将刷新以应用更改。");
                
                // 刷新页面是最稳妥的重置方式
                location.reload(); 
                
            } catch (err) {
                console.error(err);
                alert("错误：无法解析文件，可能已损坏。");
            }
        };

        reader.readAsText(file);
    }
}