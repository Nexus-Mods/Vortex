# Announcements Branch

Used to write and display official announcements within Vortex, using Vortex's in-built announcement_dashlet. The dashlet expects a 
specific JSON format to be adhered to in order to display these announcements correctly.

# Announcement Format

All data elements are optional except for the "date" and "description" elements which are mandatory.

* "date" : Expects a valid date in ISO 8601 format.

* "description" : The announcement text you wish to display.

* "githublink" : When an URL is provided, Vortex will generate a button for the announcement allowing the users to click and open
  the URL in a new webpage.

* "gamemode" : Providing a specific game id will only show this announcement when actively managing the game matching the game id.

* "icon" : The name of the icon we wish to add to this announcement - When provided, Vortex will search for the icon's name within its
  icon selection and attempt to display it alongside the description.

* "severity" : This element accepts one of the following "information" | "warning" | "critical"; this will modify UI elements accordingly
  to highlight the severity type of the announcement. (Currently only changes the color of the announcement's icon)

Example of a valid announcement:

`{
  "date": "2019-01-14T10:20:10",
  "description": "This is a fake announcement",
  "githublink": "www.github.com",
  "severity": "critical",
  "gamemode": "skyrim",
  "icon": "bug"
}`

**Please note: Upon changing the announcements.json file, it may take up to 5 minutes for the changes to be reflected within Vortex. This
is probably due to some github caching mechanism or possibly just because it takes a little while for the raw page to be queryable. During this time, Vortex's requests will return the old JSON file (pre-edit).

