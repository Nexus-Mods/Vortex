using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using FomodInstaller.Extensions;
using Utils;

namespace FomodInstaller.Interface
{
    /// <summary>
    /// Class with helper functions to analyze the structure of an archive
    /// </summary>
    public class ArchiveStructure
    {
        private FileTree m_ftFiles;
        private static IList<string> m_lstIgnore = new List<string> { "^__MACOSX" };
        private static ISet<string> m_setIgnore = new HashSet<string>(m_lstIgnore);

        public static string FindPathPrefix(IList<string> fileList, IList<string> expressions)
        {
            Regex skipExpression = new Regex(string.Join("|", m_lstIgnore), RegexOptions.IgnoreCase);
            Regex matchExpression = new Regex(string.Join("|", expressions), RegexOptions.IgnoreCase);
            int index = 0;
            string res = fileList.FirstOrDefault(filePath => {
                if (skipExpression.IsMatch(filePath))
                {
                    return false;
                }
                Match match = matchExpression.Match(filePath.Replace('\\', '/'));
                if (match.Success)
                {
                    index = match.Index;
                }
                return match.Success;
            });
            return (res != null)
                ? res.Substring(0, index)
                : "";
        }

        public ArchiveStructure(IEnumerable<string> files)
        {
            m_ftFiles = new FileTree(files);
        }

        /// <summary>
        /// This searches through the structure recursively to find one of the stop folders or files
        /// and return the path up to there.
        /// It employs a breadth first search so if there are multiple stop folders, the one with the lowest
        /// folder depth is returned.
        /// This is used to determine the path "prefix" that should be ignored in scripted installers (
        /// the scripts specify paths relative to this prefix)
        /// </summary>
        public string FindPathPrefix(IEnumerable<string> stopDirectories, IEnumerable<string> stopFiles)
        {
            List<string> MatchDirectories = stopDirectories.Select(x => "^" + x + "$").ToList();
            Regex dirExpression = new Regex(string.Join("|", MatchDirectories), RegexOptions.IgnoreCase);
            Regex fileExpression = new Regex(string.Join("|", stopFiles), RegexOptions.IgnoreCase);

            Stack<string> stkPaths = new Stack<string>();
            stkPaths.Push("");

            while (stkPaths.Count > 0)
            {
                string strSourcePath = stkPaths.Pop();

                FileTree node = m_ftFiles.SelectDirectory(strSourcePath);
                string[] directories = node.SubDirectories
                    .Select(dir => dir.Name)
                    .Where(name => !m_setIgnore.Contains(name, StringComparer.InvariantCultureIgnoreCase))
                    .ToArray();

                foreach (string strDirectory in directories)
                {
                    stkPaths.Push(Path.Combine(strSourcePath, strDirectory));
                    if (dirExpression.IsMatch(strDirectory))
                    {
                      return strSourcePath;
                    }
                }

                foreach (string strFile in node.Files)
                {
                    if (fileExpression.IsMatch(strFile))
                    {
                      return strSourcePath;
                    }
                }
            }

            return "";
        }
    }
}
