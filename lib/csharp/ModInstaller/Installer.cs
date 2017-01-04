using System.Collections.Generic;
using System.Threading.Tasks;
using Utils;
using Components.Interface;

namespace Components.ModInstaller
{
    public class Installer : BaseInstaller
    {
        #region Fields

        protected static FileSystem FileSystem;

        #endregion

        #region Properties

        #endregion

        #region Constructors

        /// <summary>
        /// A simple constructor that initializes the object with the given values.
        /// </summary>
        public Installer()
        {
        }

        #endregion

        #region Mod Installation

        /// <summary>
        /// This will determine whether the program can handle the specific archive.
        /// </summary>
        /// <param name="modArchiveFileList">The list of files inside the mod archive.</param>
        public async override Task<Dictionary<string, object>> TestSupported(List<string> modArchiveFileList)
        {
            Dictionary<string, object> Results = new Dictionary<string, object>();
            bool test = true;
            List<string> RequiredFiles = new List<string>();

            if ((modArchiveFileList == null) || (modArchiveFileList.Count == 0))
                test = false;
            else
            {
                RequiredFiles = new List<string>(await GetRequirements(modArchiveFileList));
            }

            return new Dictionary<string, object>
            {
                { "supported", test },
                { "requiredFiles", RequiredFiles }
            };
        }

        /// <summary>
        /// This will simulate the mod installation and decide installation choices and files final paths.
        /// </summary>
        /// <param name="modArchiveFileList">The list of files inside the mod archive.</param>
        /// <param name="destinationPath">The file install destination folder.</param>
        /// <param name="progressDelegate">A delegate to provide progress feedback.</param>
        /// <param name="error_OverwritesDelegate">A delegate to present errors and file overwrite requests.</param>
        /// <param name="userInteractionDelegate">A delegate to present installation choices to the user.</param>
        /// <param name="pluginQueryDelegate">A delegate to query whether a plugin already exists.</param>
        /// <param name="requiredExtenderDelegate">A delegate to query what scripted extender version is installed.</param>
        public async override Task<Dictionary<string, object>> Install(List<string> modArchiveFileList, string destinationPath, ProgressDelegate progressDelegate,
            string error_OverwritesDelegate, string userInteractionDelegate, string pluginQueryDelegate, string requiredExtenderDelegate)
        {
            List<string> IniEditList = new List<string>();

            // temporary functionality assuming this is a simple install
            List<Instruction> Instructions = await BasicModInstall(modArchiveFileList, pluginQueryDelegate, progressDelegate, error_OverwritesDelegate);
            progressDelegate(50);

            if (IniEditList != null)
            {
                foreach (string iniEdit in IniEditList)
                {
                    Instructions.Add(Instruction.CreateIniEdit(iniEdit));
                }
            }

            progressDelegate(100);

            return new Dictionary<string, object>
            {
                { "message", "Installation successful" },
                { "instructions", Instructions }
            };
        }

        #endregion

        #region Requirements

        /// <summary>
        /// This function will return the list of files requirements to complete this mod's installation.
        /// </summary>
        protected async Task<IList<string>> GetRequirements(IList<string> modFiles)
        {
            ModFormatManager FormatManager = new ModFormatManager();

            return await FormatManager.GetRequirements(modFiles);
        }

        #endregion

        #region File management

        /// <summary>
        /// This will assign all files to the proper destination.
        /// </summary>
        /// <param name="FileList">The list of files inside the mod archive.</param>
        /// <param name="pluginQueryDelegate">A delegate to query whether a plugin already exists.</param>
        /// <param name="progressDelegate">A delegate to provide progress feedback.</param>
        /// <param name="error_OverwritesDelegate">A delegate to present errors and file overwrite requests.</param>
        protected async Task<List<Instruction>> BasicModInstall(List<string> fileList, string pluginQueryDelegate, ProgressDelegate progressDelegate, string error_OverwritesDelegate)
        {
            List<Instruction> FilesToInstall = new List<Instruction>();

            await Task.Run(() =>
            {
                foreach (string ArchiveFile in fileList)
                {
                    FilesToInstall.Add(Instruction.CreateCopy(ArchiveFile, ArchiveFile));
                    // Progress should increase.	
                }
            });

            return FilesToInstall;
        }

        #endregion
    }
}
