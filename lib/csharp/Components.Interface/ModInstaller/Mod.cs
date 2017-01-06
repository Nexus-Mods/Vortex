using System;
using System.Collections.Generic;
using System.IO;

namespace Components.Interface
{
    public class Mod
    {
        #region Fields
        private string FomodFolderName = "fomod";
        private string ScreenshotFolderName = "screenshot";
        private IList<string> ModFiles;
        private string ScreenshotFilesPath = string.Empty;
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

        #endregion

        #region Constructor
        public Mod(List<string> listModFiles)
        {
            ModFiles = listModFiles;
            GetScreenshotPath(listModFiles);
        }

        #endregion

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

        public List<string> GetFileList(string targetDirectory, bool isRecursive)
        {
            List<string> lstFiles = new List<string>();
            IList<string> RequestedFiles;

            if (!string.IsNullOrEmpty(targetDirectory))
                RequestedFiles = GetFiles(targetDirectory, isRecursive);
            else
                RequestedFiles = ModFiles;

            foreach (string strFile in RequestedFiles)
                if (!strFile.StartsWith("fomod", StringComparison.OrdinalIgnoreCase))
                    lstFiles.Add(strFile);

            lstFiles.Sort(CompareOrderFoldersFirst);
            return lstFiles;
        }

        private List<string> GetFiles(string targetDirectory, bool isRecursive)
        {
            List<string> DirectoryFiles = new List<string>();

            string PathPrefix = targetDirectory;
            PathPrefix = PathPrefix.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
            PathPrefix = PathPrefix.Trim(Path.DirectorySeparatorChar);
            if (PathPrefix.Length > 0)
                PathPrefix += Path.DirectorySeparatorChar;
            int StopIndex = 0;
            foreach (string file in ModFiles)
            {
                if (file.StartsWith(PathPrefix, StringComparison.InvariantCultureIgnoreCase))
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
