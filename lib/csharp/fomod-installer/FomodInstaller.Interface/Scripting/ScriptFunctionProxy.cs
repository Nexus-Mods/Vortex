using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Security;
using System.Security.Permissions;
using System.Threading.Tasks;
using Utils;

namespace FomodInstaller.Interface
{
    /// <summary>
    /// Implements the functions availabe to scripts.
    /// </summary>
    /// <remarks>
    /// The proxy allows sandboxed scripts to call functions that can perform
    /// actions outside of the sandbox.
    /// </remarks>
    public class ScriptFunctionProxy : MarshalByRefObject
    {
        private ICollection<Instruction> modInstallInstructions;

        #region Properties

        /// <summary>
        /// Gets the mod for which the script is running.
        /// </summary>
        /// <value>The mod for which the script is running.</value>
        protected Mod Mod { get; private set; }

        /// <summary>
        /// Gets the Core delegates component.
        /// </summary>
        /// <value>The Core delegates component.</value>
        protected CoreDelegates Core { get; private set; }

        #endregion

        #region Constructors

        /// <summary>
        /// A simple constructor that initializes the object with the given values.
        /// </summary>
        /// <param name="scriptedMod">The mod for which the script is running.</param>
        /// <param name="coreDelegates">The Core delegates component.</param>
        public ScriptFunctionProxy(Mod scriptedMod, CoreDelegates coreDelegates)
        {
            Mod = scriptedMod;
            Core = coreDelegates;
        }

        #endregion

        #region Management

        /// <summary>
        /// sets the container where the function proxy should store generated instructions
        /// This has to be set before the proxy is actually used
        /// </summary>
        /// <param name="instructions"></param>
        public void SetInstructionContainer(ICollection<Instruction> instructions)
        {
            modInstallInstructions = instructions;
        }

        #endregion

        #region Event Raising

        #endregion

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
        public bool PerformBasicInstall()
        {
            return BasicModInstall(Mod.GetFileList(null, true));
        }

        #endregion

        #region File Management

        /// <summary>
        /// This will assign all files to the proper destination.
        /// </summary>
        /// <param name="FileList">The list of files inside the mod archive.</param>
        /// <param name="pluginQueryDelegate">A delegate to query whether a plugin already exists.</param>
        /// <param name="progressDelegate">A delegate to provide progress feedback.</param>
        /// <param name="error_OverwritesDelegate">A delegate to present errors and file overwrite requests.</param>
        protected bool BasicModInstall(List<string> fileList)
        {
            foreach (string ArchiveFile in fileList)
            {
                if (ArchiveFile.EndsWith("" + Path.DirectorySeparatorChar)
                    || ArchiveFile.EndsWith("" + Path.AltDirectorySeparatorChar))
                {
                    modInstallInstructions.Add(Instruction.CreateMKDir(ArchiveFile));
                }
                else
                {
                    modInstallInstructions.Add(Instruction.CreateCopy(ArchiveFile, ArchiveFile));
                }
                // Progress should increase.	
            }

            return true;
        }

        /// <summary>
        /// Installs the files in the specified folder from the mod to the file system.
        /// </summary>
        /// <param name="p_strFrom">The path of the folder in the mod containing the files to install.</param>
        /// <param name="p_booRecurse">Whether to install all files in all subfolders.</param>
        /// <returns><c>true</c> if the file was written; <c>false</c> otherwise.</returns>
        public bool InstallFolderFromMod(string p_strFrom, bool p_booRecurse)
        {
            string FromPath = p_strFrom.Trim().Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
            return InstallFolderFromMod(FromPath, FromPath, p_booRecurse);
        }

        /// <summary>
        /// Installs the files in the specified folder from the mod to the specified location on the file system.
        /// </summary>
        /// <param name="p_strFrom">The path of the folder in the mod containing the files to install.</param>
        /// <param name="p_strTo">The path on the file system where the files are to be created.</param>
        /// <param name="p_booRecurse">Whether to install all files in all subfolders.</param>
        /// <returns><c>true</c> if the file was written; <c>false</c> otherwise.</returns>
        public bool InstallFolderFromMod(string p_strFrom, string p_strTo, bool p_booRecurse)
        {
            string FromPath = p_strFrom.Trim().Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
            if (!FromPath.EndsWith(Path.DirectorySeparatorChar.ToString()))
                FromPath += Path.DirectorySeparatorChar;
            string ToPath = p_strTo.Trim().Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
            if ((ToPath.Length > 0) && (!ToPath.EndsWith(Path.DirectorySeparatorChar.ToString())))
                ToPath += Path.DirectorySeparatorChar;
            foreach (string strMODFile in GetModFileList(FromPath, p_booRecurse))
            {
                string strNewFileName = strMODFile.Substring(FromPath.Length);
                if (!InstallFileFromMod(strMODFile, Path.Combine(ToPath, strNewFileName)))
                    return false;
            }
            return true;
        }

        /// <summary>
        /// Installs the specified file from the mod to the specified location on the file system.
        /// </summary>
        /// <param name="p_strFrom">The path of the file in the mod to install.</param>
        /// <param name="p_strTo">The path on the file system where the file is to be created.</param>
        /// <returns><c>true</c> if the file was written; <c>false</c> otherwise.</returns>
        public virtual bool InstallFileFromMod(string from, string to)
        {
            bool booSuccess = false;
            string FromPath = TextUtil.NormalizePath(from, false, false, false);
            if (!string.IsNullOrEmpty(Mod.Prefix))
                FromPath = Path.Combine(Mod.Prefix, FromPath);
            string ToPath = TextUtil.NormalizePath(to, false, false, false);

            if (ToPath.EndsWith("" + Path.DirectorySeparatorChar)
                || ToPath.EndsWith("" + Path.AltDirectorySeparatorChar))
            {
                modInstallInstructions.Add(Instruction.CreateMKDir(ToPath));
            }
            else
            {
                modInstallInstructions.Add(Instruction.CreateCopy(FromPath, ToPath));
            }

            booSuccess = true;

            return booSuccess;
        }

        /// <summary>
        /// Installs the specified file from the mod to the file system.
        /// </summary>
        /// <param name="p_strFile">The path of the file to install.</param>
        /// <returns><c>true</c> if the file was written; <c>false</c> otherwise.</returns>
        public bool InstallFileFromMod(string p_strFile)
        {
            string strFile = p_strFile.Trim().Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
            return InstallFileFromMod(strFile, strFile);
        }

        /// <summary>
        /// Retrieves the list of files in the mod.
        /// </summary>
        /// <returns>The list of files in the mod.</returns>
        public string[] GetModFileList()
        {
            string[] strFiles = null;

            strFiles = Mod.GetFileList(null, true).ToArray();

            for (int i = strFiles.Length - 1; i >= 0; i--)
                strFiles[i] = strFiles[i].Replace(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            return strFiles;
        }

        /// <summary>
        /// Retrieves the list of files in the specified folder in the mod.
        /// </summary>
        /// <param name="p_strFolder">The folder whose file list is to be retrieved.</param>
        /// <param name="p_booRecurse">Whether to return files that are in subdirectories of the given directory.</param>
        /// <returns>The list of files in the specified folder in the mod.</returns>
        public string[] GetModFileList(string p_strFolder, bool p_booRecurse)
        {
            string[] strFiles = null;
            strFiles = Mod.GetFileList(p_strFolder, p_booRecurse).ToArray();

            for (int i = strFiles.Length - 1; i >= 0; i--)
                strFiles[i] = strFiles[i].Replace(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            return strFiles;
        }

        /// <summary>
        /// Retrieves the specified file from the mod.
        /// </summary>
        /// <param name="file">The file to retrieve.</param>
        /// <returns>The requested file data.</returns>
        public byte[] GetFileFromMod(string file)
        {
            byte[] bteFile = null;

            try
            {
                new SecurityPermission(SecurityPermissionFlag.UnmanagedCode).Assert();
                bteFile = Mod.GetFile(file);
            }
            finally
            {
                PermissionSet.RevertAssert();
            }

            return bteFile;
        }

        /// <summary>
        /// Gets a filtered list of all files in a user's Data directory.
        /// </summary>
        /// <param name="folderPath">The subdirectory of the Data directory from which to get the listing.</param>
        /// <param name="searchPattern">The pattern against which to filter the file paths.</param>
        /// <param name="isRecursive">Whether or not to search through subdirectories.</param>
        /// <returns>A filtered list of all files in a user's Data directory.</returns>
        public string[] GetExistingDataFileList(string folderPath, string searchPattern, bool isRecursive)
        {
            string[] FileList = null;

            Task.Run(async () => {
                FileList = await Core.context.GetExistingDataFileList(folderPath, searchPattern, isRecursive);
            }).Wait();

            return FileList;
        }

        /// <summary>
        /// Determines if the specified file exists in the user's Data directory.
        /// </summary>
        /// <param name="file">The path of the file whose existence is to be verified.</param>
        /// <returns><c>true</c> if the specified file exists; <c>false</c>
        /// otherwise.</returns>
        public bool DataFileExists(string file)
        {
            bool FileExists = false;

            if (!string.IsNullOrEmpty(Mod.Prefix))
                file = Path.Combine(Mod.Prefix, file);

            Task.Run(async () => {
                FileExists = await Core.context.CheckIfFileExists(file);
            }).Wait();

            return FileExists;
        }

        /// <summary>
        /// Gets the specified file from the user's Data directory.
        /// </summary>
        /// <param name="filePath">The path of the file to retrieve.</param>
        /// <returns>The specified file, or <c>null</c> if the file does not exist.</returns>
        public byte[] GetExistingDataFile(string filePath)
        {
            byte[] DataFile = null;

            Task.Run(async () => {
                DataFile = await Core.context.GetExistingDataFile(filePath);
            }).Wait();

            return DataFile;
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
        public bool GenerateDataFile(string destinationPath, byte[] sourceData)
        {
            bool booSuccess = false;
            string strPath = destinationPath.Trim().Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);

            modInstallInstructions.Add(Instruction.GenerateFile(Encoding.Default.GetString(sourceData), destinationPath));

            return booSuccess;
        }

        #endregion

        #region UI

        #region MessageBox

        /// <summary>
        /// Shows a message box with the given message.
        /// </summary>
        /// <param name="p_strMessage">The message to display in the message box.</param>
        public void MessageBox(string p_strMessage)
        {
            // ??? This stuff should be handled by the user interaction delegate
        }

        /// <summary>
        /// Shows a message box with the given message and title.
        /// </summary>
        /// <param name="p_strMessage">The message to display in the message box.</param>
        /// <param name="p_strTitle">The message box's title, display in the title bar.</param>
        //public void MessageBox(string p_strMessage, string p_strTitle)
        //{
        //     ??? This stuff should be handled by the user interaction delegate
        //}

        /// <summary>
        /// Shows a message box with the given message, title, and buttons.
        /// </summary>
        /// <param name="p_strMessage">The message to display in the message box.</param>
        /// <param name="p_strTitle">The message box's title, display in the title bar.</param>
        /// <param name="p_mbbButtons">The buttons to show in the message box.</param>
        public int MessageBox(string p_strMessage, string p_strTitle)
        {
            // ??? This stuff should be handled by the user interaction delegate
            return 1;
        }

        ///// <summary>
        ///// Shows a message box with the given message, title, buttons, and icon.
        ///// </summary>
        ///// <param name="p_strMessage">The message to display in the message box.</param>
        ///// <param name="p_strTitle">The message box's title, display in the title bar.</param>
        ///// <param name="p_mbbButtons">The buttons to show in the message box.</param>
        ///// <param name="p_mdiIcon">The icon to display in the message box.</param>
        //public DialogResult MessageBox(string p_strMessage, string p_strTitle)
        //{
        //    // ??? This stuff should be handled by the user interaction delegate
        //}

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
        public void ExtendedMessageBox(string p_strMessage, string p_strTitle, string p_strDetails)
        {
            Core.ui.ReportError(p_strTitle, p_strMessage, p_strDetails);
            // ??? This stuff should be handled by the user interaction delegate
        }

        #endregion

        #region Select

        /// <summary>
        /// Displays a selection form to the user.
        /// </summary>
        /// <param name="p_lstOptions">The options from which to select.</param>
        /// <param name="p_strTitle">The title of the selection form.</param>
        /// <param name="p_booSelectMany">Whether more than one items can be selected.</param>
        /// <returns>The selected option names.</returns>
        public string[] Select(IList<string> p_lstOptions, string p_strTitle, bool p_booSelectMany)
        {
            // ??? This stuff should be handled by the user interaction delegate
            return null;
        }

        #endregion

        #endregion

        #region Version Checking

        /// <summary>
        /// Gets the version of the mod manager.
        /// </summary>
        /// <returns>The version of the mod manager.</returns>
        public virtual Version GetModManagerVersion()
        {
            Version AppVersion = new Version("0.0.0.0");
            Task.Run(async () => {
                string VersionString = await Core.context.GetAppVersion();

                if (!string.IsNullOrEmpty(VersionString))
                    AppVersion = new Version(VersionString);
                else
                    AppVersion = new Version("0.0.0.0");
            }).Wait();
            return AppVersion;
        }

        /// <summary>
        /// Gets the version of the game that is installed.
        /// </summary>
        /// <returns>The version of the game, or <c>null</c> if Fallout
        /// is not installed.</returns>
        public Version GetGameVersion()
        {
            string GameVersion = Core.context.GetCurrentGameVersion().Result;
            return GameVersion != null ? new Version(GameVersion) : new Version("0.0.0.0");
        }

        public Version GetSkseVersion()
        {
            string ExtVersion = Core.context.GetExtenderVersion("skse").Result;
            return ExtVersion != null ? new Version(ExtVersion) : null;
        }

        public Version GetFoseVersion()
        {
            string ExtVersion = Core.context.GetExtenderVersion("fose").Result;
            return ExtVersion != null ? new Version(ExtVersion) : null;
        }
    
        public Version GetNvseVersion()
        {
            string ExtVersion = Core.context.GetExtenderVersion("nvse").Result;
            return ExtVersion != null ? new Version(ExtVersion) : null;
        }

        public bool ScriptExtenderPresent()
        {
            return Core.context.IsExtenderPresent().Result;
        }

        #endregion

        #region Plugin Management

        /// <summary>
        /// Gets a list of all installed plugins.
        /// </summary>
        /// <returns>A list of all installed plugins.</returns>
        public string[] GetAllPlugins()
        {
            string[] ManagedPlugins = null;

            Task.Run(async () => {
                ManagedPlugins = await Core.plugin.GetAll(false);
            }).Wait();

            return ManagedPlugins;
        }

        #region Plugin Activation Management

        /// <summary>
        /// Retrieves a list of currently active plugins.
        /// </summary>
        /// <returns>A list of currently active plugins.</returns>
        public string[] GetActivePlugins()
        {
            string[] ActivePlugins = new string[0];

            Task.Run(async () => {
                ActivePlugins = await Core.plugin.GetAll(true);
            }).Wait();

            return ActivePlugins;
        }

        /// <summary>
        /// Sets the activated status of a plugin (i.e., and esp or esm file).
        /// </summary>
        /// <param name="p_strPluginPath">The path to the plugin to activate or deactivate.</param>
        /// <param name="p_booActivate">Whether to activate the plugin.</param>
        public void SetPluginActivation(string p_strPluginPath, bool p_booActivate)
        {
            /* The system automatically activates all plugins upon deployment so there's no
            need for adding further instructions here.*/
        }

        #endregion

        #region Load Order Management

        /// <summary>
        /// Sets the load order of the specifid plugin.
        /// </summary>
        /// <param name="p_strPlugin">The path to the plugin file whose load order is to be set.</param>
        /// <param name="p_intNewIndex">The new load order index of the plugin.</param>
        protected void DoSetPluginOrderIndex(string p_strPlugin, int p_intNewIndex)
        {
            Instruction UnsupportedFunction = Instruction.UnsupportedFunctionalityWarning("DoSetPluginOrderIndex");
            if (!modInstallInstructions.Contains(UnsupportedFunction))
                modInstallInstructions.Add(UnsupportedFunction);
        }

        /// <summary>
        /// Sets the load order of the specifid plugin.
        /// </summary>
        /// <param name="p_strPlugin">The path to the plugin file whose load order is to be set.</param>
        /// <param name="p_intNewIndex">The new load order index of the plugin.</param>
        public void SetPluginOrderIndex(string p_strPlugin, int p_intNewIndex)
        {
            Instruction UnsupportedFunction = Instruction.UnsupportedFunctionalityWarning("SetPluginOrderIndex");
            if (!modInstallInstructions.Contains(UnsupportedFunction))
                modInstallInstructions.Add(UnsupportedFunction);
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
        protected void DoSetLoadOrder(int[] p_intPlugins)
        {
            // nop. It's not the job of a mod installer to control users load order
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
        public void SetLoadOrder(int[] p_intPlugins)
        {
            // nop. It's not the job of a mod installer to control users load order
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
        protected void DoSetLoadOrder(int[] p_intPlugins, int p_intPosition)
        {
            // nop. It's not the job of a mod installer to control users load order
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
        public void SetLoadOrder(int[] p_intPlugins, int p_intPosition)
        {
            // nop. It's not the job of a mod installer to control users load order
        }

        /// <summary>
        /// Orders the plugins such that the specified plugins are in the specified
        /// order.
        /// </summary>
        /// <remarks>
        /// The given plugins may not end up consecutively ordered.
        /// </remarks>
        /// <param name="p_strRelativelyOrderedPlugins">The plugins to order relative to one another.</param>
        public void SetRelativeLoadOrder(string[] p_strRelativelyOrderedPlugins)
        {
            Instruction UnsupportedFunction = Instruction.UnsupportedFunctionalityWarning("SetRelativeLoadOrder");
            if (!modInstallInstructions.Contains(UnsupportedFunction))
                modInstallInstructions.Add(UnsupportedFunction);
            // ???
            //if (p_strRelativelyOrderedPlugins.Length == 0)
            //	return;
            //List<string> lstRelativelyOrderedPlugins = new List<string>();
            //foreach (string strPlugin in p_strRelativelyOrderedPlugins)
            //	lstRelativelyOrderedPlugins.Add(GameMode.GetModFormatAdjustedPath(Mod.Format, strPlugin, false));

            //Plugin plgCurrent = null;
            //Int32 intInitialIndex = 0;
            //while (((plgCurrent = Installers.PluginManager.GetRegisteredPlugin(lstRelativelyOrderedPlugins[intInitialIndex])) == null) && (intInitialIndex < lstRelativelyOrderedPlugins.Count))
            //	intInitialIndex++;
            //if (plgCurrent == null)
            //	return;
            //for (Int32 i = intInitialIndex + 1; i < lstRelativelyOrderedPlugins.Count; i++)
            //{
            //	Plugin plgNext = Installers.PluginManager.GetRegisteredPlugin(lstRelativelyOrderedPlugins[i]);
            //	if (plgNext == null)
            //		continue;
            //	Int32 intNextPosition = Installers.PluginManager.GetPluginOrderIndex(plgNext);
            //	//we have to set this value every time, instead of caching the value (by
            //	// declaring Int32 intCurrentPosition outside of the for loop) because
            //	// calling Installers.PluginManager.SetPluginOrderIndex() does not guarantee
            //	// that the load order will change. for example trying to order an ESM
            //	// after an ESP file will result in no change, and will mean the intCurrentPosition
            //	// we are dead reckoning will be wrong
            //	Int32 intCurrentPosition = Installers.PluginManager.GetPluginOrderIndex(plgCurrent);
            //	if (intNextPosition > intCurrentPosition)
            //	{
            //		plgCurrent = plgNext;
            //		continue;
            //	}
            //	Installers.PluginManager.SetPluginOrderIndex(plgNext, intCurrentPosition + 1);
            //	//if the reorder worked, we have a new current, otherwise the old one is still the
            //	// correct current.
            //	if (intNextPosition != Installers.PluginManager.GetPluginOrderIndex(plgNext))
            //		plgCurrent = plgNext;
            //}
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
        public string GetIniString(string settingsFileName, string section, string key)
        {
            string IniValue = string.Empty;

            Task.Run(async () => {
                IniValue = await Core.ini.GetIniString(settingsFileName, section, key);
            }).Wait();

            return IniValue;
        }

        /// <summary>
        /// Retrieves the specified settings value as an integer.
        /// </summary>
        /// <param name="settingsFileName">The name of the settings file from which to retrieve the value.</param>
        /// <param name="section">The section containing the value to retrieve.</param>
        /// <param name="key">The key of the value to retrieve.</param>
        /// <returns>The specified value as an integer.</returns>
        public int GetIniInt(string settingsFileName, string section, string key)
        {
            int IniValue = -1;

            Task.Run(async () => {
                IniValue = await Core.ini.GetIniInt(settingsFileName, section, key);
            }).Wait();

            return IniValue;
        }

        #endregion

        #region Ini Editing

        /// <summary>
        /// Sets the specified value in the specified Ini file to the given value.
        /// </summary>
        /// <param name="fileName">The name of the settings file to edit.</param>
        /// <param name="section">The section in the Ini file to edit.</param>
        /// <param name="key">The key in the Ini file to edit.</param>
        /// <param name="value">The value to which to set the key.</param>
        /// <returns><c>true</c> if the value was set; <c>false</c>
        /// if the user chose not to overwrite the existing value.</returns>
        public bool EditIni(string fileName, string section, string key, string value)
        {
            modInstallInstructions.Add(Instruction.CreateIniEdit(fileName, section, key, value));
            return true;
        }

        #endregion

        #endregion
    }
}
