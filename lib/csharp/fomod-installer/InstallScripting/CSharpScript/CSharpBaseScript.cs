using System;
using System.Drawing;
using System.Security;
using System.Windows.Forms;

namespace FomodInstaller.Scripting.CSharpScript
{
    /// <summary>
    /// The base class for C# scripts.
    /// </summary>
    public class CSharpBaseScript
    {
        #region Properties

        /// <summary>
        /// Gets or sets the last generated error.
        /// </summary>
        /// <value>The last generated error.</value>
        protected static string LastError { get; set; }

        /// <summary>
        /// Gets the object that implements the script functions.
        /// </summary>
        /// <value>The object that implements the script functions.</value>
        protected static CSharpScriptFunctionProxy Functions { get; private set; }

        #endregion

        /// <summary>
        /// Sets up the script.
        /// </summary>
        /// <remarks>
        /// This method sets the <see cref="CSharpScriptFunctionProxy"/> this script will use
        /// to perform its work.
        /// </remarks>
        /// <param name="p_csfFunctions">The object that implements the script functions.</param>
        public static void Setup(CSharpScriptFunctionProxy p_csfFunctions)
        {
            Functions = p_csfFunctions;
        }


        #region Method Execution

        /// <summary>
        /// Executes the given void method.
        /// </summary>
        /// <remarks>
        /// This method is used to execute all void method calls the script needs to make.
        /// This allows for centralized error handling.
        /// 
        /// It should be noted that using delegates does engender a very slight performance hit,
        /// but given the nature of this application (more precisely, that this is a single-user
        /// application) there should not be any noticable difference.
        /// </remarks>
        /// <param name="p_gmdMethod">The method to execute.</param>
        /// <seealso cref="ExecuteMethod{T}(Func{T})"/>
        protected static void ExecuteMethod(Action p_gmdMethod)
        {
            try
            {
                p_gmdMethod();
            }
            catch (SecurityException)
            {
                throw;
            }
            catch (Exception e)
            {
                LastError = e.Message;
                if (e.InnerException != null)
                    LastError += "\n" + e.InnerException.Message;
            }
        }

        /// <summary>
        /// Executes the given method with a return value.
        /// </summary>
        /// <remarks>
        /// This method is used to execute all method calls that return a value that
        /// the script needs to make. This allows for centralized error handling.
        /// 
        /// It should be noted that using delegates does engender a very slight performance hit,
        /// but given the nature of this application (more precisely, that this is a single-user
        /// application) there should not be any noticable difference.
        /// </remarks>
        /// <typeparam name="T">The return type of the method being executed.</typeparam>
        /// <param name="p_fncMethod">The method to execute.</param>
        /// <returns>The return value of the method.</returns>
        /// <seealso cref="ExecuteMethod(Action)"/>
        protected static T ExecuteMethod<T>(Func<T> p_fncMethod)
        {
            try
            {
                T tValue = p_fncMethod();
                return tValue;
            }
            catch (SecurityException)
            {
                throw;
            }
            catch (Exception e)
            {
                LastError = e.Message;
                if (e.InnerException != null)
                    LastError += "\n" + e.InnerException.Message;
            }
            return default(T);
        }

        #endregion

        /// <summary>
        /// Returns the last error that occurred.
        /// </summary>
        /// <returns>The last error that occurred.</returns>
        public static string GetLastError()
        {
            return LastError;
        }

        #region Installation

        /// <summary>
        /// Performs a basic install of the mod.
        /// </summary>
        /// <remarks>
        /// A basic install installs all of the file in the mod to the Data directory
        /// or activates all esp and esm files.
        /// </remarks>
        /// <returns><c>true</c> if the installation succeed;
        /// <c>false</c> otherwise.</returns>
        public static bool PerformBasicInstall()
        {
            return ExecuteMethod(() => Functions.PerformBasicInstall());
        }

        #endregion

        #region File Management

        /// <summary>
        /// Installs the specified file from the mod to the specified location on the file system.
        /// </summary>
        /// <remarks>
        /// This is the legacy form of <see cref="InstallFileFromMod(string, string)"/>. It now just calls
        /// <see cref="InstallFileFromMod(string, string)"/>.
        /// </remarks>
        /// <param name="p_strFrom">The path of the file in the mod to install.</param>
        /// <param name="p_strTo">The path on the file system where the file is to be created.</param>
        /// <returns><c>true</c> if the file was written; <c>false</c> otherwise.</returns>
        /// <seealso cref="InstallFileFromMod(string, string)"/>
        public static bool CopyDataFile(string p_strFrom, string p_strTo)
        {
            return ExecuteMethod(() => Functions.CopyDataFile(p_strFrom, p_strTo));
        }

        /// <summary>
        /// Installs the specified file from the mod to the specified location on the file system.
        /// </summary>
        /// <param name="p_strFrom">The path of the file in the mod to install.</param>
        /// <param name="p_strTo">The path on the file system where the file is to be created.</param>
        /// <returns><c>true</c> if the file was written; <c>false</c> otherwise.</returns>
        public static bool InstallFileFromMod(string p_strFrom, string p_strTo)
        {
            return ExecuteMethod(() => Functions.InstallFileFromMod(p_strFrom, p_strTo));
        }

        /// <summary>
        /// Installs the speified file from the mod to the file system.
        /// </summary>
        /// <param name="p_strFile">The path of the file to install.</param>
        /// <returns><c>true</c> if the file was written; <c>false</c> otherwise.</returns>
        public static bool InstallFileFromMod(string p_strFile)
        {
            return ExecuteMethod(() => Functions.InstallFileFromMod(p_strFile));
        }

        /// <summary>
        /// Installs the specified file from the mod to the specified location on the file system.
        /// </summary>
        /// <param name="p_strFrom">The path of the file in the mod to install.</param>
        /// <param name="p_strTo">The path on the file system where the file is to be created.</param>
        /// <returns><c>true</c> if the file was written; <c>false</c> otherwise.</returns>
        public static bool InstallFileFromFomod(string p_strFrom, string p_strTo)
        {
            return InstallFileFromMod(p_strFrom, p_strTo);
        }

        /// <summary>
        /// Installs the speified file from the mod to the file system.
        /// </summary>
        /// <param name="p_strFile">The path of the file to install.</param>
        /// <returns><c>true</c> if the file was written; <c>false</c> otherwise.</returns>
        public static bool InstallFileFromFomod(string p_strFile)
        {
            return InstallFileFromMod(p_strFile, p_strFile);
        }

        /// <summary>
        /// Retrieves the list of files in the mod.
        /// </summary>
        /// <returns>The list of files in the mod.</returns>
        public static string[] GetModFileList()
        {
            return ExecuteMethod(() => Functions.GetModFileList());
        }

        /// <summary>
        /// Retrieves the list of files in the mod.
        /// </summary>
        /// <returns>The list of files in the mod.</returns>
        public static string[] GetFomodFileList()
        {
            return GetModFileList();
        }

        /// <summary>
        /// Retrieves the specified file from the mod.
        /// </summary>
        /// <param name="p_strFile">The file to retrieve.</param>
        /// <returns>The requested file data.</returns>
        public static byte[] GetFileFromMod(string p_strFile)
        {
            return ExecuteMethod(() => Functions.GetFileFromMod(p_strFile));
        }

        /// <summary>
        /// Retrieves the specified file from the mod.
        /// </summary>
        /// <param name="p_strFile">The file to retrieve.</param>
        /// <returns>The requested file data.</returns>
        public static byte[] GetFileFromFomod(string p_strFile)
        {
            return GetFileFromMod(p_strFile);
        }

        /// <summary>
        /// Gets a filtered list of all files in a user's Data directory.
        /// </summary>
        /// <param name="p_strPath">The subdirectory of the Data directory from which to get the listing.</param>
        /// <param name="p_strPattern">The pattern against which to filter the file paths.</param>
        /// <param name="p_booAllFolders">Whether or not to search through subdirectories.</param>
        /// <returns>A filtered list of all files in a user's Data directory.</returns>
        public static string[] GetExistingDataFileList(string p_strPath, string p_strPattern, bool p_booAllFolders)
        {
            return ExecuteMethod(() => Functions.GetExistingDataFileList(p_strPath, p_strPattern, p_booAllFolders));
        }

        /// <summary>
        /// Determines if the specified file exists in the user's Data directory.
        /// </summary>
        /// <param name="p_strPath">The path of the file whose existence is to be verified.</param>
        /// <returns><c>true</c> if the specified file exists; <c>false</c>
        /// otherwise.</returns>
        public static bool DataFileExists(string p_strPath)
        {
            return ExecuteMethod(() => Functions.DataFileExists(p_strPath));
        }

        /// <summary>
        /// Gets the speified file from the user's Data directory.
        /// </summary>
        /// <param name="p_strPath">The path of the file to retrieve.</param>
        /// <returns>The specified file, or <c>null</c> if the file does not exist.</returns>
        public static byte[] GetExistingDataFile(string p_strPath)
        {
            return ExecuteMethod(() => Functions.GetExistingDataFile(p_strPath));
        }

        /// <summary>
        /// Writes the file represented by the given byte array to the given path.
        /// </summary>
        /// <remarks>
        /// This method writes the given data as a file at the given path. If the file
        /// already exists the user is prompted to overwrite the file.
        /// </remarks>
        /// <param name="p_strPath">The path where the file is to be created.</param>
        /// <param name="p_bteData">The data that is to make up the file.</param>
        /// <returns><c>true</c> if the file was written; <c>false</c> otherwise.</returns>
        public static bool GenerateDataFile(string p_strPath, byte[] p_bteData)
        {
            return ExecuteMethod(() => Functions.GenerateDataFile(p_strPath, p_bteData));
        }

        #endregion

        #region UI

        #region MessageBox

        /// <summary>
        /// Shows a message box with the given message.
        /// </summary>
        /// <param name="p_strMessage">The message to display in the message box.</param>
        public static void MessageBox(string p_strMessage)
        {
            ExecuteMethod(() => Functions.MessageBox(p_strMessage));
        }

        /// <summary>
        /// Shows a message box with the given message and title.
        /// </summary>
        /// <param name="p_strMessage">The message to display in the message box.</param>
        /// <param name="p_strTitle">The message box's title, display in the title bar.</param>
        public static void MessageBox(string p_strMessage, string p_strTitle)
        {
            ExecuteMethod(() => Functions.MessageBox(p_strMessage, p_strTitle));
        }

        /// <summary>
        /// Shows a message box with the given message, title, and buttons.
        /// </summary>
        /// <param name="p_strMessage">The message to display in the message box.</param>
        /// <param name="p_strTitle">The message box's title, display in the title bar.</param>
        /// <param name="p_mbbButtons">The buttons to show in the message box.</param>
        public static DialogResult MessageBox(string p_strMessage, string p_strTitle, MessageBoxButtons p_mbbButtons)
        {
            return (DialogResult)ExecuteMethod(() => Functions.MessageBox(p_strMessage, p_strTitle, p_mbbButtons));
        }

        #endregion

        #region ExtendedMessageBox

        /// <summary>
        /// Shows an extended message box with the given message, title, details, buttons, and icon.
        /// </summary>
        /// <param name="p_strMessage">The message to display in the message box.</param>
        /// <param name="p_strTitle">The message box's title, displayed in the title bar.</param>
        /// <param name="p_strDetails">The message box's details, displayed in the details area.</param>
        /// <param name="p_mbbButtons">The buttons to show in the message box.</param>
        /// <param name="p_mdiIcon">The icon to display in the message box.</param>
        public void ExtendedMessageBox(string p_strMessage, string p_strTitle, string p_strDetails, MessageBoxButtons p_mbbButtons, MessageBoxIcon p_mdiIcon)
        {
            ExecuteMethod(() => Functions.ExtendedMessageBox(p_strMessage, p_strTitle, p_strDetails));
        }

        #endregion

        #region Select

        /// <summary>
        /// Displays a selection form to the user.
        /// </summary>
        /// <param name="p_sopOptions">The options from which to select.</param>
        /// <param name="p_strTitle">The title of the selection form.</param>
        /// <param name="p_booSelectMany">Whether more than one item can be selected.</param>
        /// <returns>The indices of the selected items.</returns>
        public static int[] Select(SelectOption[] p_sopOptions, string p_strTitle, bool p_booSelectMany)
        {
            return (int[])ExecuteMethod(() => Functions.Select(p_sopOptions, p_strTitle, p_booSelectMany));
        }

        /// <summary>
        /// Displays a selection form to the user.
        /// </summary>
        /// <remarks>
        /// The items, previews, and descriptions are repectively ordered. In other words,
        /// the i-th item in <paramref name="p_strItems"/> uses the i-th preview in
        /// <paramref name="p_strPreviewPaths"/> and the i-th description in <paramref name="p_strDescriptions"/>.
        /// 
        /// Similarly, the idices return as results correspond to the indices of the items in
        /// <paramref name="p_strItems"/>.
        /// </remarks>
        /// <param name="p_strItems">The items from which to select.</param>
        /// <param name="p_strPreviewPaths">The preview image file names for the items.</param>
        /// <param name="p_strDescriptions">The descriptions of the items.</param>
        /// <param name="p_strTitle">The title of the selection form.</param>
        /// <param name="p_booSelectMany">Whether more than one item can be selected.</param>
        /// <returns>The indices of the selected items.</returns>
        public static int[] Select(string[] p_strItems, string[] p_strPreviewPaths, string[] p_strDescriptions, string p_strTitle, bool p_booSelectMany)
        {
            return (int[])ExecuteMethod(() => Functions.Select(p_strItems, p_strPreviewPaths, p_strDescriptions, p_strTitle, p_booSelectMany));
        }

        /// <summary>
        /// Displays a selection form to the user.
        /// </summary>
        /// <remarks>
        /// The items, previews, and descriptions are repectively ordered. In other words,
        /// the i-th item in <paramref name="p_strItems"/> uses the i-th preview in
        /// <paramref name="p_imgPreviews"/> and the i-th description in <paramref name="p_strDescriptions"/>.
        /// 
        /// Similarly, the idices return as results correspond to the indices of the items in
        /// <paramref name="p_strItems"/>.
        /// </remarks>
        /// <param name="p_strItems">The items from which to select.</param>
        /// <param name="p_imgPreviews">The preview images for the items.</param>
        /// <param name="p_strDescriptions">The descriptions of the items.</param>
        /// <param name="p_strTitle">The title of the selection form.</param>
        /// <param name="p_booSelectMany">Whether more than one item can be selected.</param>
        /// <returns>The indices of the selected items.</returns>
        public static int[] ImageSelect(string[] p_strItems, Image[] p_imgPreviews, string[] p_strDescriptions, string p_strTitle, bool p_booSelectMany)
        {
            return (int[])ExecuteMethod(() => Functions.Select(p_strItems, p_imgPreviews, p_strDescriptions, p_strTitle, p_booSelectMany));
        }

        #endregion

        /// <summary>
        /// Creates a form that can be used in custom mod scripts.
        /// </summary>
        /// <returns>A form that can be used in custom mod scripts.</returns>
        public static Form CreateCustomForm()
        {
            return ExecuteMethod(() => {
                Form res = new Form();
                res.Shown += (Object sender, EventArgs e) =>
                {
                    res.TopMost = true;
                };
                return res;
                });
        }

        #endregion

        #region Version Checking

        /// <summary>
        /// Gets the version of the mod manager.
        /// </summary>
        /// <returns>The version of the mod manager.</returns>
        public static Version GetModManagerVersion()
        {
            return ExecuteMethod(() => Functions.GetModManagerVersion());
        }

        /// <summary>
        /// Gets the version of the game that is installed.
        /// </summary>
        /// <returns>The version of the game, or <c>null</c> if Fallout
        /// is not installed.</returns>
        public static Version GetGameVersion()
        {
            return ExecuteMethod(() => Functions.GetGameVersion());
        }

        /// <summary>
        /// Gets the script extender version or null if it's not installed
        /// </summary>
        /// <returns></returns>
        public static Version GetSkseVersion()
        {
            return ExecuteMethod(() => Functions.GetSkseVersion());
        }

        /// <summary>
        /// Gets the script extender version or null if it's not installed
        /// </summary>
        /// <returns></returns>
        public static Version GetFoseVersion()
        {
            return ExecuteMethod(() => Functions.GetFoseVersion());
        }

        /// <summary>
        /// Gets the script extender version or null if it's not installed
        /// </summary>
        /// <returns></returns>
        public static Version GetNvseVersion()
        {
            return ExecuteMethod(() => Functions.GetNvseVersion());
        }

        #region Version Checking

        /// <summary>
        /// Gets the version of the mod manager.
        /// </summary>
        /// <returns>The version of the mod manager.</returns>
        public static Version GetFommVersion()
        {
            return ExecuteMethod(() => Functions.GetModManagerVersion());
        }

        /// <summary>
        /// Gets the version of the game that is installed.
        /// </summary>
        /// <returns>The version of the game, or <c>null</c> if Fallout
        /// is not installed.</returns>
        public static Version GetFalloutVersion()
        {
            return ExecuteMethod(() => Functions.GetGameVersion());
        }

        #endregion

        /// <summary>
        /// Determins if the script extender for the game is installed
        /// (this checks for the script extender of the game for which the
        /// mod is being installed)
        /// </summary>
        /// <returns></returns>
        public static bool ScriptExtenderPresent()
        {
            return ExecuteMethod(() => Functions.ScriptExtenderPresent());
        }

        #endregion

        #region Plugin Management

        /// <summary>
        /// Gets a list of all install plugins.
        /// </summary>
        /// <returns>A list of all install plugins.</returns>
        public static string[] GetAllPlugins()
        {
            return ExecuteMethod(() => Functions.GetAllPlugins());
        }

        #region Plugin Activation Management

        /// <summary>
        /// Retrieves a list of currently active plugins.
        /// </summary>
        /// <returns>A list of currently active plugins.</returns>
        public static string[] GetActivePlugins()
        {
            return ExecuteMethod(() => Functions.GetActivePlugins());
        }

        /// <summary>
        /// Sets the activated status of a plugin (i.e., and esp or esm file).
        /// </summary>
        /// <param name="p_strPluginPath">The path to the plugin to activate or deactivate.</param>
        /// <param name="p_booActivate">Whether to activate the plugin.</param>
        public static void SetPluginActivation(string p_strPluginPath, bool p_booActivate)
        {
            ExecuteMethod(() => Functions.SetPluginActivation(p_strPluginPath, p_booActivate));
        }

        #endregion

        #region Load Order Management

        /// <summary>
        /// Sets the load order of the specifid plugin.
        /// </summary>
        /// <param name="p_strPlugin">The path to the plugin file whose load order is to be set.</param>
        /// <param name="p_intNewIndex">The new load order index of the plugin.</param>
        public static void SetPluginOrderIndex(string p_strPlugin, int p_intNewIndex)
        {
            ExecuteMethod(() => Functions.SetPluginOrderIndex(p_strPlugin, p_intNewIndex));
        }

        /// <summary>
        /// Sets the load order of the plugins.
        /// </summary>
        /// <remarks>
        /// Each plugin will be moved from its current index to its indices' position
        /// in <paramref name="p_intPlugins"/>.
        /// </remarks>
        /// <param name="p_intPlugins">The new load order of the plugins. Each entry in this array
        /// contains the current index of a plugin. This array must contain all current indices.</param>
        public static void SetLoadOrder(int[] p_intPlugins)
        {
            ExecuteMethod(() => Functions.SetLoadOrder(p_intPlugins));
        }

        /// <summary>
        /// Moves the specified plugins to the given position in the load order.
        /// </summary>
        /// <remarks>
        /// Note that the order of the given list of plugins is not maintained. They are re-ordered
        /// to be in the same order as they are in the before-operation load order. This, I think,
        /// is somewhat counter-intuitive and may change, though likely not so as to not break
        /// backwards compatibility.
        /// </remarks>
        /// <param name="p_intPlugins">The list of plugins to move to the given position in the
        /// load order. Each entry in this array contains the current index of a plugin.</param>
        /// <param name="p_intPosition">The position in the load order to which to move the specified
        /// plugins.</param>
        public static void SetLoadOrder(int[] p_intPlugins, int p_intPosition)
        {
            ExecuteMethod(() => Functions.SetLoadOrder(p_intPlugins, p_intPosition));
        }

        #endregion

        #endregion

        #region Ini File Value Management

        #region Ini File Value Retrieval

        /// <summary>
        /// Retrieves the specified settings value as a string.
        /// </summary>
        /// <param name="settingsFileName">The name of the settings file from which to retrieve the value.</param>
        /// <param name="section">The section containing the value to retrieve.</param>
        /// <param name="key">The key of the value to retrieve.</param>
        /// <returns>The specified value as a string.</returns>
        public static string GetIniString(string settingsFileName, string section, string key)
        {
            return ExecuteMethod(() => Functions.GetIniString(settingsFileName, section, key));
        }

        /// <summary>
        /// Retrieves the specified settings value as an integer.
        /// </summary>
        /// <param name="settingsFileName">The name of the settings file from which to retrieve the value.</param>
        /// <param name="section">The section containing the value to retrieve.</param>
        /// <param name="key">The key of the value to retrieve.</param>
        /// <returns>The specified value as an integer.</returns>
        public static int GetIniInt(string settingsFileName, string section, string key)
        {
            return ExecuteMethod(() => Functions.GetIniInt(settingsFileName, section, key));
        }

        /// <summary>
        /// Retrieves the specified Fallout.ini value as a string.
        /// </summary>
        /// <param name="section">The section containing the value to retrieve.</param>
        /// <param name="key">The key of the value to retrieve.</param>
        /// <returns>The specified value as a string.</returns>
        /// <seealso cref="GetFalloutIniInt(string, string)"/>
        public static string GetFalloutIniString(string section, string key)
        {
            return ExecuteMethod(() => Functions.GetIniString("Fallout.ini", section, key));
        }

        /// <summary>
        /// Retrieves the specified Fallout.ini value as an integer.
        /// </summary>
        /// <param name="section">The section containing the value to retrieve.</param>
        /// <param name="key">The key of the value to retrieve.</param>
        /// <seealso cref="GetFalloutIniString(string, string)"/>
        public static int GetFalloutIniInt(string section, string key)
        {
            return ExecuteMethod(() => Functions.GetIniInt("Fallout.ini", section, key));
        }

        /// <summary>
        /// Retrieves the specified FalloutPrefs.ini value as a string.
        /// </summary>
        /// <param name="p_strSection">The section containing the value to retrieve.</param>
        /// <param name="p_strKey">The key of the value to retrieve.</param>
        /// <returns>The specified value as a string.</returns>
        /// <seealso cref="GetPrefsIniInt(string, string)"/>
        public string GetPrefsIniString(string p_strSection, string p_strKey)
        {
            return ExecuteMethod(() => Functions.GetIniString("FalloutPrefs.ini", p_strSection, p_strKey));
        }

        /// <summary>
        /// Retrieves the specified FalloutPrefs.ini value as an integer.
        /// </summary>
        /// <param name="p_strSection">The section containing the value to retrieve.</param>
        /// <param name="p_strKey">The key of the value to retrieve.</param>
        /// <returns>The specified value as an integer.</returns>
        /// <seealso cref="GetPrefsIniString(string, string)"/>
        public int GetPrefsIniInt(string p_strSection, string p_strKey)
        {
            return ExecuteMethod(() => Functions.GetIniInt("FalloutPrefs.ini", p_strSection, p_strKey));
        }

        #endregion

        #region Ini Editing

        /// <summary>
        /// Sets the specified value in the specified Ini file to the given value.
        /// </summary>
        /// <param name="p_strSettingsFileName">The name of the settings file to edit.</param>
        /// <param name="p_strSection">The section in the Ini file to edit.</param>
        /// <param name="p_strKey">The key in the Ini file to edit.</param>
        /// <param name="p_strValue">The value to which to set the key.</param>
        /// <returns><c>true</c> if the value was set; <c>false</c>
        /// if the user chose not to overwrite the existing value.</returns>
        public static bool EditIni(string p_strSettingsFileName, string p_strSection, string p_strKey, string p_strValue)
        {
            return ExecuteMethod(() => Functions.EditIni(p_strSettingsFileName, p_strSection, p_strKey, p_strValue));
        }

        /// <summary>
        /// Sets the specified value in the Fallout.ini file to the given value. 
        /// </summary>
        /// <param name="p_strSection">The section in the Ini file to edit.</param>
        /// <param name="p_strKey">The key in the Ini file to edit.</param>
        /// <param name="p_strValue">The value to which to set the key.</param>
        /// <param name="p_booSaveOld">Not used.</param>
        /// <returns><c>true</c> if the value was set; <c>false</c>
        /// if the user chose not to overwrite the existing value.</returns>
        public static bool EditFalloutINI(string p_strSection, string p_strKey, string p_strValue, bool p_booSaveOld)
        {
            return ExecuteMethod(() => (Functions.EditIni("fallout.ini", p_strSection, p_strKey, p_strValue)));
        }

        #endregion

        #endregion
    }
}
