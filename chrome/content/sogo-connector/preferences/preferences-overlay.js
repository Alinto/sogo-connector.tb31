function jsInclude(files, target) {
    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                           .getService(Components.interfaces.mozIJSSubScriptLoader);
    for (let i = 0; i < files.length; i++) {
        try {
            loader.loadSubScript(files[i], target);
        }
        catch(e) {
            dump("preferences-overlay.js: failed to include '" + files[i] + "'\n" + e + "\n");
        }
    }
}

jsInclude(["chrome://sogo-connector/content/addressbook/categories.js"]);

let gSOGoConnectorPane = {
    init: function SCP_init() {
        let appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
            .getService(Components.interfaces.nsIXULRuntime);
        if (appInfo.OS == "Darwin") {
            let prefwindow = document.getElementById("MailPreferences");
            prefwindow.setAttribute("arch", "mac");
        }
        this.contactCategoriesPane.init();
    },

    tabSelectionChanged: function SCP_tabSelectionChanged() {
    },

    contactCategoriesPane: {
        mCategoryList: null,

        init: function SCP_cCP_init() {
            this.mCategoryList = SCContactCategories.getCategoriesAsArray();
            this.updateCategoryList();
        },

        updateCategoryList: function SCP_cCPupdateCategoryList() {
            this.mCategoryList = SCContactCategories.getCategoriesAsArray();
            let listbox = document.getElementById("SOGoConnectorContactCategoriesList");
            listbox.clearSelection();
            while (listbox.lastChild.id != "categoryColumns") {
                listbox.removeChild(listbox.lastChild);
            }
            this.updateButtons();

            for (let i = 0; i < this.mCategoryList.length; i++) {
                let newListItem = document.createElement("listitem");
                newListItem.setAttribute("id", this.mCategoryList[i]);
                let categoryName = document.createElement("listcell");
                categoryName.setAttribute("label", this.mCategoryList[i]);
                newListItem.appendChild(categoryName);
                listbox.appendChild(newListItem);
            }
        },

        updateButtons: function SCP_cCPupdateButtons() {
            let categoriesList = document.getElementById("SOGoConnectorContactCategoriesList");
            document.getElementById("SOGoConnectorDeleteContactCategoryButton")
                    .disabled = (categoriesList.selectedCount == 0);
            document.getElementById("SOGoConnectorEditContactCategoryButton")
                    .disabled = (categoriesList.selectedCount != 1);
        },

        _addCategory: function SCP_cCP__addCategory(newName) {
            if (this.mCategoryList.indexOf(newName) < 0) {
                this.mCategoryList.push(newName);
                SCContactCategories.setCategoriesAsArray(this.mCategoryList);
                this.updateCategoryList();
            }
        },

        _editCategory: function SCP_cCP__editCategory(idx, newName) {
            if (this.mCategoryList.indexOf(newName) < 0) {
                this.mCategoryList[idx] = newName;
                SCContactCategories.setCategoriesAsArray(this.mCategoryList);
                this.updateCategoryList();
            }
        },

        /* actions */
        onAddCategory: function SCP_cCP_addCategory() {
            let listbox = document.getElementById("SOGoConnectorContactCategoriesList");
            listbox.clearSelection();
            this.updateButtons();

            let this_ = this;
            let saveObject = {
                setCategoryName: function SCP_cCP_sO_setCategoryName(newName) {
                    this_._addCategory(newName);
                }
            };
            window.openDialog("chrome://sogo-connector/content/preferences/edit-category.xul",
                              "addCategory", "modal,centerscreen,chrome,resizable=no",
                              "", addTitle, saveObject);
        },
        onEditCategory: function SCP_cCP_editCategory() {
            let list = document.getElementById("SOGoConnectorContactCategoriesList");
            if (list.selectedCount == 1) {
                let this_ = this;
                let saveObject = {
                    setCategoryName: function SCP_cCP_sO_setCategoryName(newName) {
                        this_._editCategory(list.selectedIndex, newName);
                    }
                };
                window.openDialog("chrome://sogo-connector/content/preferences/edit-category.xul",
                                  "editCategory", "modal,centerscreen,chrome,resizable=no",
                                  this.mCategoryList[list.selectedIndex], editTitle, saveObject);
            }
        },
        onDeleteCategory: function SCP_cCP_deleteCategory() {
            let list = document.getElementById("SOGoConnectorContactCategoriesList");
            if (list.selectedCount > 0) {
                let selection = list.selectedItems.concat([]);
                let lastItem = selection[selection.length-1];
                let newSelection = selection.nextSibling;
                if (!newSelection || newSelection.tagName != "listitem") {
                    newSelection = selection[0].previousSibling;
                    if (newSelection.tagName != "listitem") {
                        newSelection = null;
                    }
                }
                for (let i = 0; i < selection.length; i++) {
                    list.removeChild(selection[i]);
                }
                list.selectedItem = newSelection;
                this.updateButtons();

                this.mCategoryList = [];
                let newNodes = list.childNodes;
                for (let i = 0; i < newNodes.length; i++) {
                    if (newNodes[i].tagName == "listitem") {
                        this.mCategoryList.push(newNodes[i].getAttribute("id"));
                    }
                }
                SCContactCategories.setCategoriesAsArray(this.mCategoryList);
            }
        }
    }
};
