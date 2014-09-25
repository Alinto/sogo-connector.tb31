let SCContactCategories = {
    getCategoriesAsString: function SCCC_getCategoriesAsString() {
        let cats = null;

        let prefService = Components.classes["@mozilla.org/preferences-service;1"]
                                    .getService(Components.interfaces.nsIPrefBranch);
        try {
            cats = prefService.getCharPref("sogo-connector.contacts.categories");
        }
        catch(e) {
            let strService = Components.classes["@mozilla.org/intl/stringbundle;1"]
                                       .getService(Components.interfaces.nsIStringBundleService);
            let bundle = strService.createBundle("chrome://sogo-connector/locale/preferences/categories.properties");
            cats = bundle.GetStringFromName("contacts.categories");
        }

        return cats;
    },

    setCategoriesAsString: function SCCC_setCategoriesAsString(cats) {
        let prefService = Components.classes["@mozilla.org/preferences-service;1"]
                                    .getService(Components.interfaces.nsIPrefBranch);
        prefService.setCharPref("sogo-connector.contacts.categories", cats);
    },

    getCategoriesAsArray: function SCCC_getCategoriesAsArray() {
        let valuesArray = [];

        let multiValue = this.getCategoriesAsString();
        let max = multiValue.length;
        if (multiValue.length > 0) {
            let escaped = false;
            let current = "";
            for (let i = 0; i < max; i++) {
                if (escaped) {
                    current += multiValue[i];
                    escaped = false;
                }
                else {
                    if (multiValue[i] == "\\") {
                        escaped = true;
                    }
                    else if (multiValue[i] == ",") {
                        valuesArray.push(current.replace(/(^[ ]+|[ ]+$)/, "", "g"));
                        current = "";
                    }
                    else {
                        current += multiValue[i];
                    }
                }
            }
            if (current.length > 0) {
                valuesArray.push(current.replace(/(^[ ]+|[ ]+$)/, "", "g"));
            }
        }

        return valuesArray;
    },

    _sortArray: function SCCC__sortArray(catsArray) {
        let localeService = Components.classes["@mozilla.org/intl/nslocaleservice;1"]
                                      .getService(Components.interfaces.nsILocaleService);
        let collator = Components.classes["@mozilla.org/intl/collation-factory;1"]
                                 .getService(Components.interfaces.nsICollationFactory)
                                 .CreateCollation(localeService.getApplicationLocale());
        function compare(a, b) { return collator.compareString(0, a, b); }
        catsArray.sort(compare);
    },

    setCategoriesAsArray: function SCCC_getCategoriesAsArray(catsArray) {
        this._sortArray(catsArray);

        let initted = false;
        let cats = "";
        for (let i = 0; i < catsArray.length; i++) {
            if (catsArray[i] && catsArray[i].length > 0) {
                let escaped = catsArray[i].replace(",", "\\,").replace(/(^[ ]+|[ ]+$)/, "", "g");
                if (escaped.length > 0) {
                    if (initted) {
                        cats += "," + escaped;
                    }
                    else {
                        cats += escaped;
                        initted = true;
                    }
                }
            }
        }

        this.setCategoriesAsString(cats);
    }
};
