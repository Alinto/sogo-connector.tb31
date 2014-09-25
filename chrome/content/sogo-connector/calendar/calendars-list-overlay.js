function jsInclude(files, target) {
    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                           .getService(Components.interfaces.mozIJSSubScriptLoader);
    for (let i = 0; i < files.length; i++) {
        try {
            loader.loadSubScript(files[i], target);
        }
        catch(e) {
            dump("calendars-list-overlay.js: failed to include '" + files[i] +
                 "'\n" + e
                 + "\nFile: " + e.fileName
                 + "\nLine: " + e.lineNumber + "\n\n Stack:\n\n" + e.stack);
        }
    }
}

jsInclude(["chrome://inverse-library/content/calendar-cache.js"]);

//
// This code was pretty much taken out from calCalendarManager.js: -changeCalendarCache
// New SOGo properties were added in the propsToCopy array.
//
function reinitCalendarCache(aCalendar) {
    reloadCalendarCache(aCalendar);
}
