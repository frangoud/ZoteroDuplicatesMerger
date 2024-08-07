const { Localization } = ChromeUtils.import(
  "resource://gre/modules/Localization.jsm"
);
const l10n = new Localization([
  "chrome://zoteroduplicatesmerger/locale/duplicatesmerger.ftl",
  "chrome://zoteroduplicatesmerger/locale/options.ftl",
]);

async function getLocalizedString(id, args = {}) {
  let message = await l10n.formatValue(id, args);
  return message;
}

async function loadIntoWindow(window) {
  let document = window.document;

  let name = await getLocalizedString("duplicatesmerger-name");
  let preferences = await getLocalizedString("duplicatesmerger-preferences");

  let header = document.createElement("h1");
  header.textContent = name;

  let subHeader = document.createElement("h2");
  subHeader.textContent = preferences;

  document.body.appendChild(header);
  document.body.appendChild(subHeader);

  // Additional DOM manipulation can be added here
}

function loadPreferences() {
  Services.prefs.readUserPrefs(
    "chrome://zoteroduplicatesmerger/content/prefs.js"
  );
}

function startup(data, reason) {
  loadPreferences();

  // Register the content, locale, and skin resources
  ChromeUtils.registerChrome(
    new Map([
      ["content", "zoteroduplicatesmerger", "chrome/content/"],
      ["locale", "zoteroduplicatesmerger", "en-US", "chrome/locale/en-US/"],
      [
        "skin",
        "zoteroduplicatesmerger",
        "default",
        "chrome/skin/default/zoteroduplicatesmerger/",
      ],
    ])
  );

  let windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let window = windows.getNext();
    loadIntoWindow(window);
  }
  Services.wm.addListener(windowListener);
}

function shutdown(data, reason) {
  // Unregister the resources when the extension is disabled or uninstalled
  ChromeUtils.unregisterChrome(
    new Map([
      ["content", "zoteroduplicatesmerger"],
      ["locale", "zoteroduplicatesmerger"],
      ["skin", "zoteroduplicatesmerger"],
    ])
  );

  let windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let window = windows.getNext();
    unloadFromWindow(window);
  }
  Services.wm.removeListener(windowListener);
}

function install(data, reason) {}
function uninstall(data, reason) {}

var windowListener = {
  onOpenWindow: function (aWindow) {
    let window = aWindow
      .QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIDOMWindow);
    window.addEventListener(
      "load",
      function () {
        window.removeEventListener("load", arguments.callee, false);
        loadIntoWindow(window);
      },
      false
    );
  },

  onCloseWindow: function (aWindow) {},
  onWindowTitleChange: function (aWindow, aTitle) {},
};
