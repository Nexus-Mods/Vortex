using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using FomodInstaller.Extensions;
using FomodInstaller.Scripting;
using Utils;
using System.Diagnostics;

namespace FomodInstaller.Interface
{
    public class Mod
    {
        private static readonly HashSet<string> imageExtensions = new HashSet<string>()
        {
            "png",
            "jpg",
            "bmp",
            "gif"
        };

        #region Fields
        private string FomodRoot = "fomod";
        private string FomodScreenshotPath = "fomod/screenshot";
        private IList<string> ModFiles;
        private IList<string> StopPatterns;
        private string ScreenshotFilesPath = string.Empty;
        private string InstallScriptPath = null;
        private string PathPrefix = null;
        private IScriptType InstallScriptType = null;
        private IScript ModInstallScript = null;
        #endregion

        #region Properties

        public string ScreenshotPath
        {
            get
            {
                return ScreenshotFilesPath;
            }
        }

        public string Prefix
        {
            get
            {
                return PathPrefix;
            }
        }

        public IList<string> ModFileList
        {
            get
            {
                return ModFiles;
            }
        }

        public string TempPath
        {
            get;
            private set;
        }

        /// <summary>
        /// Gets whether the mod has a custom install script.
        /// </summary>
        /// <value>Whether the mod has a custom install script.</value>
        public bool HasInstallScript
        {
            get
            {
                return ModInstallScript != null;
            }
        }

        /// <summary>
        /// Gets or sets the mod's install script.
        /// </summary>
        /// <value>The mod's install script.</value>
        public IScript InstallScript
        {
            get
            {
                return ModInstallScript;
            }
            set
            {
                ModInstallScript = value;
                if (ModInstallScript == null)
                {
                    InstallScriptType = null;
                    InstallScriptPath = null;
                }
                else
                {
                    InstallScriptType = ModInstallScript.Type;
                    InstallScriptPath = Path.Combine(FomodRoot, InstallScriptType.FileNames[0]);
                }
            }
        }

        #endregion

        #region Constructor
        
        /// <summary>
        /// This provides interaction with the mod files.
        /// </summary>
        /// <param name="listModFiles">The list of files inside the mod archive.</param>
        /// <param name="stopPatterns">patterns matching files or directories that should be at the top of the directory structure.</param>
        /// <param name="installScriptPath">The path to the uncompressed install script file, if any.</param>
        /// <param name="tempFolderPath">Temporary path where install scripts can work.</param>
        /// <param name="scriptType">The script type, if any.</param>
        public Mod(List<string> listModFiles,
                   List<string> stopPatterns,
                   string installScriptPath, string tempFolderPath, IScriptType scriptType)
        {
            ModFiles = listModFiles;
            StopPatterns = stopPatterns;
            GetScreenshotPath(listModFiles);
            InstallScriptPath = installScriptPath;
            TempPath = tempFolderPath;
            InstallScriptType = scriptType;
        }

        #endregion

        public async Task Initialize()
        {
            await Task.Run(() => GetScreenshotPath(ModFiles));
            await GetScriptFile();
        }

        private async Task GetScriptFile()
        {
            byte[] scriptData = null;

            if (!string.IsNullOrEmpty(InstallScriptPath))
            {
                await Task.Run(() =>
                {
                    scriptData = FileSystem.ReadAllBytes(Path.Combine(TempPath, InstallScriptPath));
                    ModInstallScript = InstallScriptType.LoadScript(TextUtil.ByteToString(scriptData));
                    // when we have an install script, do we really assume that this script uses paths relative
                    // to what our heuristics assumes is the top level directory?
                    int offset = InstallScriptPath.IndexOf(Path.Combine("fomod", "ModuleConfig.xml"),
                                                           StringComparison.InvariantCultureIgnoreCase);
                    if (offset == -1)
                    {
                        PathPrefix = ArchiveStructure.FindPathPrefix(ModFiles, StopPatterns);
                    } else
                    {
                        PathPrefix = InstallScriptPath.Substring(0, offset);
                    }
                });
            }
        }

        private void GetScreenshotPath(IList<string> listModFiles)
        {
            IList<string> NormalizedModFile = NormalizePathList(ModFiles);
            foreach (string filePath in NormalizedModFile)
            {
                if (filePath.Contains(FomodScreenshotPath, StringComparison.InvariantCultureIgnoreCase))
                {
                    ScreenshotFilesPath = filePath;
                    break;
                }
            }
        }

        public byte[] GetFile(string file)
        {
            if (!string.IsNullOrEmpty(PathPrefix) || !file.StartsWith(PathPrefix, StringComparison.InvariantCultureIgnoreCase))
                file = Path.Combine(PathPrefix, file);
            file = TextUtil.NormalizePath(file, false, true);

            IList<string> NormalizedModFile = NormalizePathList(ModFiles);
            if (!NormalizedModFile.Any(x => x.Contains(file, StringComparison.InvariantCultureIgnoreCase)))
            {
                if (IsImageFile(Path.GetFileName(file)))
                    return (byte[])(new ImageConverter().ConvertTo(new Bitmap(1, 1), typeof(byte[])));
                else
                    throw new FileNotFoundException("File doesn't exist in FOMod", file);
            }

            string filePath = Path.Combine(TempPath, file);

            if (FileSystem.FileExists(filePath))
                return FileSystem.ReadAllBytes(filePath);
            else
                return null;
        }

        public List<string> GetFileList(string targetDirectory, bool isRecursive)
        {
            List<string> lstFiles = new List<string>();
            IList<string> RequestedFiles;

            if (!string.IsNullOrEmpty(targetDirectory))
                RequestedFiles = GetFiles(targetDirectory, isRecursive);
            else
                RequestedFiles = ModFiles;

            foreach (string strFile in RequestedFiles)
                if (!strFile.StartsWith(FomodRoot, StringComparison.OrdinalIgnoreCase))
                    lstFiles.Add(strFile);

            return lstFiles;
        }

        private List<string> GetFiles(string targetDirectory, bool isRecursive)
        {
            List<string> DirectoryFiles = new List<string>();
            List<string> Directories = new List<string>();

            string PathPrefix = TextUtil.NormalizePath(targetDirectory, true);

            int StopIndex = 0;
            foreach (string file in ModFiles)
            {
                if (TextUtil.NormalizePath(file).StartsWith(PathPrefix))
                {
                    if (!isRecursive)
                    {
                        StopIndex = file.IndexOf(Path.DirectorySeparatorChar, PathPrefix.Length);
                        if (StopIndex > 0)
                            continue;
                    }
                    if (file.EndsWith(Path.DirectorySeparatorChar.ToString()) || file.EndsWith(Path.AltDirectorySeparatorChar.ToString()))
                      Directories.Add(file);
                    else
                      DirectoryFiles.Add(file);
                }
            }

            foreach (string directory in Directories)
              if (!DirectoryFiles.Any(x => x.IndexOf(directory, StringComparison.InvariantCultureIgnoreCase) >= 0))
                DirectoryFiles.Add(directory);

            return DirectoryFiles;
        }

        #region Helper Methods

        private bool IsImageFile(string file)
        {
            string FileExtension = Path.GetExtension(file);
            return (Path.GetFileNameWithoutExtension(file).Equals("screenshot", StringComparison.InvariantCultureIgnoreCase) || imageExtensions.Contains(FileExtension, StringComparer.InvariantCultureIgnoreCase));
        }

        private IList<string> NormalizePathList(IList<string> paths)
        {
            List<string> NormalizedPaths = new List<string>();

            foreach (string path in paths)
                NormalizedPaths.Add(TextUtil.NormalizePath(path, false, true));

            return NormalizedPaths;
        }

        private static int CompareOrderFoldersFirst(string x, string y)
        {
            if (string.IsNullOrEmpty(x))
            {
                if (string.IsNullOrEmpty(y))
                    return 0;
                else
                    return -1;
            }
            else
            {
                if (string.IsNullOrEmpty(y))
                    return 1;
                else
                {
                    string xDir = Path.GetDirectoryName(x);
                    string yDir = Path.GetDirectoryName(y);

                    if (string.IsNullOrEmpty(xDir))
                    {
                        if (string.IsNullOrEmpty(yDir))
                            return 0;
                        else
                            return 1;
                    }
                    else
                    {
                        if (string.IsNullOrEmpty(yDir))
                            return -1;
                        else
                        {
                            return xDir.CompareTo(yDir);
                        }
                    }
                }
            }
        }

        #endregion
    }
}
