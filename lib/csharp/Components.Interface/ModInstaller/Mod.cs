using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Components.Scripting;
using Utils;

namespace Components.Interface
{
    public class Mod
    {
        #region Fields
        private string FomodRoot = "fomod";
        private string ScreenshotFolderName = "screenshot";
        private IList<string> ModFiles;
        private string ScreenshotFilesPath = string.Empty;
        private string InstallScriptPath = null;
        private string TempPath = null;
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

        public IList<string> ModFileList
        {
            get
            {
                return ModFiles;
            }
        }

        /// <summary>
        /// Gets whether the mod has a custom install script.
        /// </summary>
        /// <value>Whether the mod has a custom install script.</value>
        public bool HasInstallScript
        {
            get
            {
                return InstallScript != null;
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
        public Mod(List<string> listModFiles, string installScriptPath, string tempFolderPath, IScriptType scriptType)
        {
            ModFiles = listModFiles;
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
                    scriptData = FileSystem.ReadAllBytes(InstallScriptPath);
                });

                await Task.Run(() =>
                {
                    ModInstallScript = InstallScriptType.LoadScript(TextUtil.ByteToString(scriptData));
                });
            }
        }

        private void GetScreenshotPath(IList<string> listModFiles)
        {
            foreach (string filePath in listModFiles)
            {
                string checkScreenshotPath = Path.GetFileName(Path.GetDirectoryName(filePath));
                if (checkScreenshotPath.Equals(ScreenshotFolderName, StringComparison.InvariantCultureIgnoreCase))
                {
                    string checkFomodPath = Path.GetFileName(Path.GetDirectoryName(checkScreenshotPath));
                    if (checkFomodPath.Equals(ScreenshotFolderName, StringComparison.InvariantCultureIgnoreCase))
                    {
                        ScreenshotFilesPath = checkScreenshotPath;
                        break;
                    }
                }
            }
        }

        public byte[] GetFile(string file)
        {
            if (!ModFiles.Contains(file, StringComparer.InvariantCultureIgnoreCase))
            {
                if (Path.GetFileNameWithoutExtension(file).Equals("screenshot", StringComparison.InvariantCultureIgnoreCase))
                    return (byte[])(new ImageConverter().ConvertTo(new Bitmap(1, 1), typeof(byte[])));
                else
                    throw new FileNotFoundException("File doesn't exist in FOMod", file);
            }

            string filePath = Path.Combine(TempPath, file);

            return FileSystem.ReadAllBytes(filePath);
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

            string PathPrefix = NormalizePath(targetDirectory, true);

            int StopIndex = 0;
            foreach (string file in ModFiles)
            {
                if (NormalizePath(file).StartsWith(PathPrefix))
                {
                    if (!isRecursive)
                    {
                        StopIndex = file.IndexOf(Path.DirectorySeparatorChar, PathPrefix.Length);
                        if (StopIndex > 0)
                            continue;
                    }
                    DirectoryFiles.Add(file);
                }
            }

            return DirectoryFiles;
        }

        private string NormalizePath(string path, bool dirTerminate = false)
        {
            string temp = path
                .Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar)
                .Trim(Path.DirectorySeparatorChar)
                .ToLowerInvariant();
            if (dirTerminate && (temp.Length > 0))
            {
                temp += Path.DirectorySeparatorChar;
            }
            return temp;
        }

        public static int CompareOrderFoldersFirst(string x, string y)
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
    }
}
