using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using FomodInstaller.Interface;
using FomodInstaller.Scripting;
using System.Text.RegularExpressions;

namespace FomodInstaller.ModInstaller
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
            IList<string> RequiredFiles = new List<string>();

            if ((modArchiveFileList == null) || (modArchiveFileList.Count == 0))
                test = false;
            else
            {
                try
                {
                    RequiredFiles = await GetRequirements(modArchiveFileList, true);
                } catch (UnsupportedException)
                {
                    RequiredFiles = new List<string>();
                    // files without an installer script are still supported by this
                }

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
        /// <param name="stopPatterns">patterns matching files or directories that should be at the top of the directory structure.</param>
        /// <param name="scriptPath">The path to the uncompressed install script file, if any.</param>
        /// <param name="progressDelegate">A delegate to provide progress feedback.</param>
        /// <param name="coreDelegate">A delegate for all the interactions with the js core.</param>
        public async override Task<Dictionary<string, object>> Install(List<string> modArchiveFileList,
                                                                       List<string> stopPatterns,
                                                                       string pluginPath,
                                                                       string scriptPath,
                                                                       ProgressDelegate progressDelegate,
                                                                       CoreDelegates coreDelegate)
        {
            IList<Instruction> Instructions = new List<Instruction>();
            ModFormatManager FormatManager = new ModFormatManager();
            string ScriptFilePath = null;

            try
            {
                ScriptFilePath = new List<string>(await GetRequirements(modArchiveFileList, false)).FirstOrDefault();
            }
            catch (UnsupportedException)
            {
                // not an error, this can handle mods without an installer script (see BasicModInstall)
            }
            IScriptType ScriptType = await GetScriptType(modArchiveFileList);
            Mod modToInstall = new Mod(modArchiveFileList, stopPatterns, ScriptFilePath, scriptPath, ScriptType);
            await modToInstall.Initialize();

            progressDelegate(50);

            if (modToInstall.HasInstallScript)
            {
                Instructions = await ScriptedModInstall(modToInstall, progressDelegate, coreDelegate);
                if (Instructions == null)
                {
                    Instructions = new List<Instruction>();
                    Instructions.Add(Instruction.InstallError("Installer failed (it should have reported an error message)"));
                } else
                {
                    // f***ing ugly hack, but this is in NMM so...
                    if (pluginPath != null)
                    {
                        string pattern = pluginPath + Path.DirectorySeparatorChar;
                        Instructions = Instructions.Select(instruction =>
                        {
                            Instruction output = instruction;
                            if ((output.type == "copy") && output.destination.StartsWith(pattern, System.StringComparison.InvariantCultureIgnoreCase))
                            {
                                output.destination = output.destination.Substring(pattern.Length);
                            }
                            return output;
                        }).ToList();
                    }
                }
            }
            else
            {
                Instructions = await BasicModInstall(modArchiveFileList, stopPatterns, progressDelegate, coreDelegate);
            }

            progressDelegate(100);

            return new Dictionary<string, object>
            {
                { "message", "Installation successful" },
                { "instructions", Instructions }
            };
        }

        #endregion

        #region Mod Format Management

        /// <summary>
        /// This function will return the list of files requirements to complete this mod's installation.
        /// <param name="modFiles">The list of files inside the mod archive.</param>
        /// <param name="includeAssets">If true, the result will also include all assets required by the
        ///   installer (i.e. screenshots). Otherwise the result should only be one file which is the
        ///   installer script</param>
        /// </summary>
        protected async Task<IList<string>> GetRequirements(IList<string> modFiles, bool includeAssets)
        {
            ModFormatManager FormatManager = new ModFormatManager();

            return await FormatManager.GetRequirements(modFiles, includeAssets);
        }

        /// <summary>
        /// This function will return the list of files requirements to complete this mod's installation.
        /// <param name="modFiles">The list of files inside the mod archive.</param>
        /// </summary>
        protected async Task<IScriptType> GetScriptType(IList<string> modFiles)
        {
            ModFormatManager FormatManager = new ModFormatManager();

            return await FormatManager.GetScriptType(modFiles);
        }

        #endregion

        #region Install Management

        /// <summary>
        /// This will assign all files to the proper destination.
        /// </summary>
        /// <param name="fileList">The list of files inside the mod archive.</param>
        /// <param name="stopPatterns">patterns matching files or directories that should be at the top of the directory structure.</param>
        /// <param name="progressDelegate">A delegate to provide progress feedback.</param>
        /// <param name="coreDelegate">A delegate for all the interactions with the js core.</param>
        protected async Task<List<Instruction>> BasicModInstall(List<string> fileList,
                                                                List<string> stopPatterns,
                                                                ProgressDelegate progressDelegate,
                                                                CoreDelegates coreDelegate)
        {
            List<Instruction> FilesToInstall = new List<Instruction>();
            string prefix = ArchiveStructure.FindPathPrefix(fileList, stopPatterns);

            await Task.Run(() =>
            {
                foreach (string ArchiveFile in fileList)
                {
                    if (ArchiveFile.EndsWith("" + Path.DirectorySeparatorChar))
                    {
                        // don't include directories, only files
                        continue;
                    }
                    string destination;
                    if (ArchiveFile.StartsWith(prefix))
                    {
                        destination = ArchiveFile.Substring(prefix.Length);
                    } else
                    {
                        destination = ArchiveFile;
                    }
                    FilesToInstall.Add(Instruction.CreateCopy(ArchiveFile, destination));
                    // Progress should increase.	
                }
            });

            return FilesToInstall;
        }

        /// <summary>
        /// This will assign all files to the proper destination.
        /// </summary>
        /// <param name="modArchive">The list of files inside the mod archive.</param>
        /// <param name="prefixPath">base path for all relative paths</param>
        /// <param name="progressDelegate">A delegate to provide progress feedback.</param>
        /// <param name="coreDelegate">A delegate for all the interactions with the js core.</param>
        protected async Task<IList<Instruction>> ScriptedModInstall(Mod modArchive, ProgressDelegate progressDelegate, CoreDelegates coreDelegate)
        {
            IScriptExecutor sexScript = modArchive.InstallScript.Type.CreateExecutor(modArchive, coreDelegate);
            return await sexScript.Execute(modArchive.InstallScript, modArchive.TempPath);
        }

        #endregion
    }
}
