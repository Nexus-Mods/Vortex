using System;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using Util.Collections;

namespace Util
{
	/// <summary>
	/// static path operations. Please note that these operations all work completely independent of the actual
	/// contents of the filesytem.
	/// </summary>
	public class PathUtil
	{
		private static readonly Regex m_rgxCleanPath = new Regex("[" + Regex.Escape("" + Path.DirectorySeparatorChar + Path.AltDirectorySeparatorChar) + "]{2,}");

		/// <summary>
		/// Determines whether or not the given path represents a drive.
		/// </summary>
		/// <param name="p_strPath">The path for which it is to be determine whether it represents a drive.</param>
		/// <returns><c>true</c> the the given path represents a drive;
		/// <c>false</c> otherwise.</returns>
		public static bool IsDrivePath(string p_strPath)
		{
			return p_strPath.Trim(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar).EndsWith(Path.VolumeSeparatorChar.ToString(), StringComparison.OrdinalIgnoreCase);
		}

		/// <summary>
		/// Determines if the given path contains invalid characters.
		/// </summary>
		/// <param name="p_strPath">The path to examine.</param>
		/// <returns><c>true</c> if the given path contains invalid characters;
		/// <c>false</c> otherwise.</returns>
		public static bool ContainsInvalidPathChars(string p_strPath)
		{
			if (String.IsNullOrEmpty(p_strPath))
				return false;
			Set<string> setChars = new Set<string>();

			string strFile;
			try
			{
				strFile = Path.GetFileName(p_strPath);
				int colon = p_strPath.LastIndexOf(':');
				if ((colon != -1) && (colon != 1))
				{
					// colon can only appear after the drive letter
					return true;
				}
				return p_strPath.IndexOfAny("*?".ToCharArray()) != -1;
			} catch (ArgumentException)
			{
				// GetFileName throws an ArgumentException on invalid path charaters
				return true;
			}
		}

		/// <summary>
		/// Determines if the given path is valid.
		/// </summary>
		/// <param name="p_strPath">The path to examine.</param>
		/// <returns><c>true</c> if the given path is valid;
		/// <c>false</c> if it contains invalid chars or it's too long.</returns>
		public static bool IsValidPath(string p_strPath)
		{
			if (String.IsNullOrEmpty(p_strPath))
				return false;
			else if ((p_strPath.Length >= 260) || (p_strPath.LastIndexOf(@"\") >= 247))
				return false;
			else
				return !ContainsInvalidPathChars(p_strPath);
		}

		/// <summary>
		/// Removes all invalid characters from the given path.
		/// </summary>
		/// <param name="p_strPath">The path to clean.</param>
		/// <returns>The given path with all invalid characters removed.</returns>
		public static string StripInvalidPathChars(string p_strPath)
		{
			if (String.IsNullOrEmpty(p_strPath))
				return p_strPath;
			Set<string> setChars = new Set<string>();

			p_strPath = p_strPath.Replace("\"", "");

			string strPath = Path.GetDirectoryName(p_strPath);
			foreach (char chrInvalidChar in Path.GetInvalidPathChars())
				setChars.Add("\\x" + ((Int32)chrInvalidChar).ToString("x2"));
			Regex rgxInvalidPath = new Regex("[" + String.Join("", setChars.ToArray()) + "]");
			strPath = rgxInvalidPath.Replace(strPath, "");

			string strFile = Path.GetFileName(p_strPath);
			setChars.Clear();
			foreach (char chrInvalidChar in Path.GetInvalidFileNameChars())
				setChars.Add("\\x" + ((Int32)chrInvalidChar).ToString("x2"));
			rgxInvalidPath = new Regex("[" + String.Join("", setChars.ToArray()) + "]");
			strFile = rgxInvalidPath.Replace(strFile, "");

			return Path.Combine(strPath, strFile);
		}

		/// <summary>
		/// Generates a path that is relative to another path.
		/// </summary>
		/// <param name="p_strRoot">The root directory with respect to which the path will be made relative.</param>
		/// <param name="p_strPath">The path to make relative.</param>
		/// <returns>The relative form of the given path, relative with respect to the given root.</returns>
		/// <exception cref="ArgumentNullException">Thrown if either parameter is <c>null</c>.</exception>
		public static string RelativizePath(string p_strRoot, string p_strPath)
		{
			if (p_strRoot == null)
				throw new ArgumentNullException("p_strFrom");
			if (p_strPath == null)
				throw new ArgumentNullException("p_strRoot");

			p_strRoot = p_strRoot.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
			p_strPath = p_strPath.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);

			if (Path.IsPathRooted(p_strRoot) && Path.IsPathRooted(p_strPath) && !Path.GetPathRoot(p_strRoot).Equals(Path.GetPathRoot(p_strPath), StringComparison.OrdinalIgnoreCase))
				return p_strPath;

			string[] strRootPaths = p_strRoot.Split(new char[] { Path.DirectorySeparatorChar }, StringSplitOptions.RemoveEmptyEntries);
			string[] strPathsToRelativize = p_strPath.Split(new char[] { Path.DirectorySeparatorChar }, StringSplitOptions.RemoveEmptyEntries);

			Int32 intMinPathLength = Math.Min(strRootPaths.Length, strPathsToRelativize.Length);
			Int32 intLastCommonPathIndex = -1;
			for (Int32 i = 0; i < intMinPathLength; i++)
			{
				if (!strRootPaths[i].Equals(strPathsToRelativize[i], StringComparison.OrdinalIgnoreCase))
					break;
				intLastCommonPathIndex = i;
			}
			if (intLastCommonPathIndex == -1)
				return p_strPath;

			List<string> lstRelativePaths = new List<string>();
			for (Int32 i = intLastCommonPathIndex + 1; i < strRootPaths.Length; i++)
				lstRelativePaths.Add("..");
			for (Int32 i = intLastCommonPathIndex + 1; i < strPathsToRelativize.Length; i++)
				lstRelativePaths.Add(strPathsToRelativize[i]);

			return String.Join(Path.DirectorySeparatorChar.ToString(), lstRelativePaths.ToArray());
		}

		/// <summary>
		/// Normalizes the given path.
		/// </summary>
		/// <remarks>
		/// This removes multiple consecutive path separators and makes sure all path
		/// separators are <see cref="Path.DirectorySeparatorChar"/>.
		/// </remarks>
		/// <param name="p_strPath">The path to normalize.</param>
		/// <returns>The normalized path.</returns>
		public static string NormalizePath(string p_strPath)
		{
			string strNormalizedPath = m_rgxCleanPath.Replace(p_strPath, Path.DirectorySeparatorChar.ToString());
			strNormalizedPath = strNormalizedPath.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
			strNormalizedPath = strNormalizedPath.Trim(Path.DirectorySeparatorChar);
			return strNormalizedPath;
		}

		/// <summary>
		/// fix the filename by replacing all characters that can't appear in a filename by underscores
		/// </summary>
		/// <param name="p_strInput"></param>
		/// <returns></returns>
		public static string SanitizeFilename(string p_strInput)
		{
			foreach (char chrInvalid in Path.GetInvalidFileNameChars())
				p_strInput = p_strInput.Replace(chrInvalid, '_');
			return p_strInput;
		}
	}
}
