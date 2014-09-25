window.addEventListener("load", SCOnLoad, false);

function SCOnLoad()
{
    let item = window.calendarItem;
    if (item.id === null) { /* item is new */
        let prefName = null;
        if (cal.isEvent(item)) {
            prefName = "calendar.events.default-classification";
        }
        else if (cal.isToDo(item)) {
            prefName = "calendar.todos.default-classification";
        }
        if (prefName) {
            gPrivacy = getPrefSafe(prefName, "PUBLIC");
            updatePrivacy();
        }
    }
}
