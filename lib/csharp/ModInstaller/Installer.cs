using System.Collections.Generic;
using System.Threading.Tasks;
using Utils;
using Components.Interface;
using Components.Scripting.XmlScript;
using Components.Scripting;

namespace Components.ModInstaller
{
    public class Installer : BaseInstaller
    {
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
        /// <param name="scriptPath">The path to the uncompressed install script file, if any.</param>
        /// <param name="progressDelegate">A delegate to provide progress feedback.</param>
        /// <param name="coreDelegate">A delegate for all the interactions with the js core.</param>
        public async override Task<Dictionary<string, object>> Install(List<string> modArchiveFileList,
            string scriptPath, ProgressDelegate progressDelegate, CoreDelegates coreDelegate)
        {
            IList<Instruction> Instructions = new List<Instruction>();
            Mod modToInstall = new Mod(modArchiveFileList, scriptPath);

            progressDelegate(50);

            if (modToInstall.HasInstallScript)
                Instructions = await ScriptedModInstall(modToInstall, progressDelegate, coreDelegate);
            else
                Instructions = await BasicModInstall(modArchiveFileList, progressDelegate, coreDelegate);

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
        /// <param name="modFiles">The list of files inside the mod archive.</param>
        /// </summary>
        protected async Task<IList<string>> GetRequirements(IList<string> modFiles)
        {
            ModFormatManager FormatManager = new ModFormatManager();

            return await FormatManager.GetRequirements(modFiles);
        }

        #endregion

        #region Install Management

        /// <summary>
        /// This will assign all files to the proper destination.
        /// </summary>
        /// <param name="fileList">The list of files inside the mod archive.</param>
        /// <param name="progressDelegate">A delegate to provide progress feedback.</param>
        /// <param name="coreDelegate">A delegate for all the interactions with the js core.</param>
        protected async Task<List<Instruction>> BasicModInstall(List<string> fileList, ProgressDelegate progressDelegate, CoreDelegates coreDelegate)
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

        /// <summary>
        /// This will assign all files to the proper destination.
        /// </summary>
        /// <param name="modArchive">The list of files inside the mod archive.</param>
        /// <param name="progressDelegate">A delegate to provide progress feedback.</param>
        /// <param name="coreDelegate">A delegate for all the interactions with the js core.</param>
        protected async Task<IList<Instruction>> ScriptedModInstall(Mod modArchive, ProgressDelegate progressDelegate, CoreDelegates coreDelegate)
        {
            IList<Instruction> Instructions = new List<Instruction>();

            IScriptExecutor sexScript = modArchive.InstallScript.Type.CreateExecutor(modArchive, coreDelegate);
            return await sexScript.Execute(modArchive.InstallScript);
        }

        #endregion
    }
}
