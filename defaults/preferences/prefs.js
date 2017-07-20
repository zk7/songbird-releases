
// Used to detect the first time the extension is run 
pref("extensions.releases.firstrun", true);

//Used to detect whether to load library artist releases only
pref("extensions.releases.libraryartists", true);

//Used to determine how many months forward we should query releases forward
pref("extensions.releases.futuremonths", 3);

//Used to determine whether to clear releases DB on application exit
pref("extensions.releases.savesession", false);

//Used to detect which theme to use - default light
pref("extensions.releases.theme", 1);

//Used to determine which metadata field to compare by - default 'artist'
pref("extensions.releases.compareby", 1);
// See http://kb.mozillazine.org/Localize_extension_descriptions
// pref("extensions.{977caad0-4a65-49e4-a304-421e5a0329df}.description", "chrome://releases/locale/releases.properties");
