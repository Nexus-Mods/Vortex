using System;
using System.Collections.Generic;
using System.IO;
using Utils.Collections;

namespace FomodInstaller.Scripting.ModScript
{
	/// <summary>
	/// Provides the function context to use when executing Mod Script scripts.
	/// </summary>
	/// <remarks>
	/// This provides some methods for changing the state of the script execution
	/// context. This includes tracking variable values, and files that should not
	/// be installed.
	/// 
	/// All values in Mod Script are strings. Thus, all parameters to the functions
	/// are strings. If they represent another datatype, the functions must
	/// convert the values before using them.
	/// 
	/// There are a few exceptions, where some methods accept non-string parameters.
	/// This is becuase these methods are called by the interpreter, and not from
	/// the interpreted code.
	/// </remarks>
	public class ModScriptInterpreterContext
	{
		private List<string> m_setExcludedFiles = new List<string>();
		private List<string> m_lstPluginOrder = new List<string>();
		private bool m_booInstallDataFiles = true;
		private bool m_booInstallPlugins = true;

		#region Properties

		/// <summary>
		/// Gets the variables being used by the script.
		/// </summary>
		/// <value>The variables being used by the script.</value>
		protected Dictionary<string, string> Variables { get; private set; }

		/// <summary>
		/// Gets the proxy that provides implementations of functions used
		/// by the script.
		/// </summary>
		/// <value>The proxy that provides implementations of functions used
		/// by the script.</value>
		public ModScriptFunctionProxy FunctionProxy { get; private set; }

		#endregion

		#region Constructors

		/// <summary>
		/// A simple construtor that initializes the object with the given dependencies.
		/// </summary>
		/// <param name="p_msfFunctions">The object that proxies the script function calls
		/// out of the sandbox.</param>
		public ModScriptInterpreterContext(ModScriptFunctionProxy p_msfFunctions)
		{
			Variables = new Dictionary<string, string>(StringComparer.InvariantCultureIgnoreCase);
			FunctionProxy = p_msfFunctions;
			Variables.Add("NewLine", Environment.NewLine);
			Variables.Add("Tab", "\t");
		}

		#endregion

		/// <summary>
		/// Gets the value of the specified variable.
		/// </summary>
		/// <param name="p_strVariableName">The name of the variable whose value is to be returned.</param>
		/// <returns>The value of the specified variable.</returns>
		public string GetVar(string p_strVariableName)
		{
			string strValue = null;
			Variables.TryGetValue(p_strVariableName, out strValue);
			return strValue;
		}

		/// <summary>
		/// Sets the value of the specified varaible.
		/// </summary>
		/// <param name="p_strVariableName">The name of the variable whose value is to be set.</param>
		/// <param name="p_strValue">The value to assign to the specified variable.</param>
		public void SetVar(string p_strVariableName, string p_strValue)
		{
			Variables[p_strVariableName] = p_strValue;
		}

		#region String Functions

		/// <summary>
		/// Gets the specified substring of the given value, and stores it in the specified variable.
		/// </summary>
		/// <param name="p_strVariableName">The name of the variable in which to store the substring.</param>
		/// <param name="p_strValue">The value from which to get the substring.</param>
		/// <param name="p_strStart">The inclusive start position of the substring.</param>
		public void Substring(string p_strVariableName, string p_strValue, string p_strStart)
		{
			Variables[p_strVariableName] = FunctionProxy.Substring(p_strValue, p_strStart);
		}

		/// <summary>
		/// Gets the specified substring of the given value, and stores it in the specified variable.
		/// </summary>
		/// <param name="p_strVariableName">The name of the variable in which to store the substring.</param>
		/// <param name="p_strValue">The value from which to get the substring.</param>
		/// <param name="p_strStart">The inclusive start position of the substring.</param>
		/// <param name="p_strLength">The length of the substring.</param>
		public void Substring(string p_strVariableName, string p_strValue, string p_strStart, string p_strLength)
		{
			Variables[p_strVariableName] = FunctionProxy.Substring(p_strValue, p_strStart, p_strLength);
		}

		/// <summary>
		/// Removes the specified substring from the given value, and stores it in the specified variable.
		/// </summary>
		/// <param name="p_strVariableName">The name of the variable in which to store the substring.</param>
		/// <param name="p_strValue">The value from which to remove the substring.</param>
		/// <param name="p_strStart">The inclusive start position of the substring.</param>
		/// <returns>The given value without the specified substring.</returns>
		public void RemoveString(string p_strVariableName, string p_strValue, string p_strStart)
		{
			Variables[p_strVariableName] = FunctionProxy.RemoveString(p_strValue, p_strStart);
		}

		/// <summary>
		/// Removes the specified substring from the given value, and stores it in the specified variable.
		/// </summary>
		/// <param name="p_strVariableName">The name of the variable in which to store the substring.</param>
		/// <param name="p_strValue">The value from which to remove the substring.</param>
		/// <param name="p_strStart">The inclusive start position of the substring.</param>
		/// <param name="p_strLength">The length of the substring.</param>
		/// <returns>The given value without the specified substring.</returns>
		public void RemoveString(string p_strVariableName, string p_strValue, string p_strStart, string p_strLength)
		{
			Variables[p_strVariableName] = FunctionProxy.RemoveString(p_strValue, p_strStart, p_strLength);
		}

		/// <summary>
		/// Gets the length of the given value, and stores it in the specified variable.
		/// </summary>
		/// <param name="p_strVariableName">The name of the variable in which to store the length.</param>
		/// <param name="p_strValue">The value from whose length is to be determined.</param>
		/// <returns>The length of the given value.</returns>
		public void StringLength(string p_strVariableName, string p_strValue)
		{
			Variables[p_strVariableName] = FunctionProxy.StringLength(p_strValue);
		}

		#endregion

		#region Path Manipulation

		/// <summary>
		/// Combines the given paths, and stores it in the specified variable.
		/// </summary>
		/// <param name="p_strVariableName">The name of the variable in which to store the conbined path.</param>
		/// <param name="p_strPath1">The first path to combine.</param>
		/// <param name="p_strPath2">The second path to combine.</param>
		/// <returns>The combined paths.</returns>
		public void CombinePaths(string p_strVariableName, string p_strPath1, string p_strPath2)
		{
			Variables[p_strVariableName] = FunctionProxy.CombinePaths(p_strPath1, p_strPath2);
		}

		/// <summary>
		/// Gets the name of the directory of the given path, and stores it in the specified variable.
		/// </summary>
		/// <param name="p_strVariableName">The name of the variable in which to store the conbined path.</param>
		/// <param name="p_strPath">The path from which to extract the directory name.</param>
		/// <returns>The name of the directory of the given path.</returns>
		public void GetDirectoryName(string p_strVariableName, string p_strPath)
		{
			Variables[p_strVariableName] = FunctionProxy.GetDirectoryName(p_strPath);
		}

		/// <summary>
		/// Gets the name of the file of the given path, including extension, and stores it in the specified variable.
		/// </summary>
		/// <param name="p_strVariableName">The name of the variable in which to store the conbined path.</param>
		/// <param name="p_strPath">The path from which to extract the file name.</param>
		/// <returns>The name of the file of the given path, including extension..</returns>
		public void GetFileName(string p_strVariableName, string p_strPath)
		{
			Variables[p_strVariableName] = FunctionProxy.GetFileName(p_strPath);
		}

		/// <summary>
		/// Gets the name of the file of the given path, excluding extension, and stores it in the specified variable.
		/// </summary>
		/// <param name="p_strVariableName">The name of the variable in which to store the combined path.</param>
		/// <param name="p_strPath">The path from which to extract the file name.</param>
		/// <returns>The name of the file of the given path, excluding extension..</returns>
		public void GetFileNameWithoutExtension(string p_strVariableName, string p_strPath)
		{
			Variables[p_strVariableName] = FunctionProxy.GetFileNameWithoutExtension(p_strPath);
		}

		#endregion

		#region UI

		#region Text Input

		/// <summary>
		/// Displays text editor, and stores the entered text in the specified variable.
		/// </summary>
		/// <param name="p_strVariableName">The name of the variable in which to store the text.</param>
		/// <returns>The text entered into the editor.</returns>
		public void InputString(string p_strVariableName)
		{
			Variables[p_strVariableName] = FunctionProxy.InputString();
		}

		/// <summary>
		/// Displays text editor, and returns the entered text in the specified variable.
		/// </summary>
		/// <param name="p_strVariableName">The name of the variable in which to store the text.</param>
		/// <param name="p_strTitle">The titel of the editor.</param>
		/// <returns>The text entered into the editor.</returns>
		public void InputString(string p_strVariableName, string p_strTitle)
		{
			Variables[p_strVariableName] = FunctionProxy.InputString(p_strTitle, null);
		}

		/// <summary>
		/// Displays text editor, and returns the entered text in the specified variable.
		/// </summary>
		/// <param name="p_strVariableName">The name of the variable in which to store the text.</param>
		/// <param name="p_strTitle">The titel of the editor.</param>
		/// <param name="p_strInitialValue">The initial value of the editor.</param>
		/// <returns>The text entered into the editor.</returns>
		public void InputString(string p_strVariableName, string p_strTitle, string p_strInitialValue)
		{
			Variables[p_strVariableName] = FunctionProxy.InputString(p_strTitle, p_strInitialValue);
		}

		#endregion

		#endregion

		#region Installation

		/// <summary>
		/// Installs all files in the mod that have not been excluded from being installed.
		/// </summary>
		public void CompleteFileInstallation()
		{
			if (m_booInstallDataFiles)
				InstallAllDataFiles();
			if (m_booInstallPlugins)
				InstallAllPlugins();
			FunctionProxy.SetRelativeLoadOrder(m_lstPluginOrder.ToArray());
		}

		/// <summary>
		/// Instructs the installer not to automatically install the data files.
		/// </summary>
		public void DontInstallAnyDataFiles()
		{
			m_booInstallDataFiles = false;
		}

		/// <summary>
		/// Instructs the installer not to automatically install the plugins.
		/// </summary>
		public void DontInstallAnyPlugins()
		{
			m_booInstallPlugins = false;
		}

		/// <summary>
		/// Installs all non-plugin files that have not been excluded.
		/// </summary>
		public void InstallAllDataFiles()
		{
			string[] strFiles = FunctionProxy.GetModFileList();
			foreach (string strFile in strFiles)
			{
				if (FunctionProxy.IsPlugin(strFile) || m_setExcludedFiles.Contains(strFile))
					continue;
				FunctionProxy.InstallFileFromMod(strFile);
			}
		}

		/// <summary>
		/// Installs all plugin files that have not been excluded.
		/// </summary>
		public void InstallAllPlugins()
		{
			string[] strFiles = FunctionProxy.GetModFileList();
			foreach (string strFile in strFiles)
			{
				if (!FunctionProxy.IsPlugin(strFile) || m_setExcludedFiles.Contains(strFile))
					continue;
				FunctionProxy.InstallFileFromMod(strFile);
			}
		}

		/// <summary>
		/// Adds the given files in the specified mod folder to the list of files not to install when doing an install.
		/// </summary>
		/// <param name="p_strPath">The path of the folder in the mod whose files to exclude when doing an install.</param>
		/// <param name="p_strRecurse">Whether to exclude all files in all subfolders.</param>
		public void DontInstallModFolder(string p_strPath, string p_strRecurse)
		{
			bool booRecurse = Boolean.Parse(p_strRecurse);
			foreach (string strMODFile in FunctionProxy.GetModFileList(p_strPath, booRecurse))
				m_setExcludedFiles.Add(strMODFile);
		}

		/// <summary>
		/// Adds the given files in the specified mod folder to the list of files not to install when doing an install.
		/// </summary>
		/// <remarks>
		/// This is an alias for <see cref="DontInstallModFolder(string, string)"/>. It exists
		/// to maintain compatibility with old Mod Scripts.
		/// </remarks>
		/// <param name="p_strPath">The path of the folder in the mod whose files to exclude when doing an install.</param>
		/// <seealso cref="DontInstallModFolder(string, string)"/>
		public void DontInstallDataFolder(string p_strPath)
		{
			DontInstallModFolder(p_strPath, false.ToString());
		}

		/// <summary>
		/// Adds the given files in the specified mod folder to the list of files not to install when doing an install.
		/// </summary>
		/// <remarks>
		/// This is an alias for <see cref="DontInstallModFolder(string, string)"/>. It exists
		/// to maintain compatibility with old Mod Scripts.
		/// </remarks>
		/// <param name="p_strPath">The path of the folder in the mod whose files to exclude when doing an install.</param>
		/// <param name="p_strRecurse">Whether to exclude all files in all subfolders.</param>
		/// <seealso cref="DontInstallModFolder(string, string)"/>
		public void DontInstallDataFolder(string p_strPath, string p_strRecurse)
		{
			DontInstallModFolder(p_strPath, p_strRecurse);
		}

		#endregion

		#region File Management

		/// <summary>
		/// Adds the given file to the list of files not to install when doing an install.
		/// </summary>
		/// <param name="p_strPath">The path of the file in the mod to exclude when doing an install.</param>
		public void DontInstallModFile(string p_strPath)
		{
			m_setExcludedFiles.Add(p_strPath);
		}

		/// <summary>
		/// Installs the specified file from the mod to the file system.
		/// </summary>
		/// <remarks>
		/// This is an alias for <see cref="DontInstallModFile(string)"/>. It exists
		/// to maintain compatibility with old Mod Scripts.
		/// </remarks>
		/// <param name="p_strPath">The path of the file to install.</param>
		/// <seealso cref="DontInstallModFile(string)"/>
		public void DontInstallDataFile(string p_strPath)
		{
			DontInstallModFile(p_strPath);
		}

		/// <summary>
		/// Installs the specified file from the mod to the file system.
		/// </summary>
		/// <remarks>
		/// This is an alias for <see cref="DontInstallModFile(string)"/>. It exists
		/// to maintain compatibility with old Mod Scripts.
		/// </remarks>
		/// <param name="p_strPath">The path of the file to install.</param>
		/// <seealso cref="DontInstallModFile(string)"/>
		public void DontInstallPlugin(string p_strPath)
		{
			DontInstallModFile(p_strPath);
		}

		#endregion

		#region Plugin Management

		/// <summary>
		/// Ensures that one plugin is loaded before another.
		/// </summary>
		/// <param name="p_strLoadFirst">The plugin to load before the other specified plugin.</param>
		/// <param name="p_strLoadSecond">The plugin before which to load the other specified plugin.</param>
		public void LoadBefore(string p_strLoadFirst, string p_strLoadSecond)
		{
			string strLoadFirst = Path.GetFileName(p_strLoadFirst);
			string[] strFiles = FunctionProxy.GetModFileList();
			if (!strFiles.Contains(x => x.Equals(strLoadFirst, StringComparison.OrdinalIgnoreCase)))
				return;
			string strLoadSecond = Path.GetFileName(p_strLoadSecond);
			Int32 intFirstPos = m_lstPluginOrder.IndexOf(strLoadFirst, StringComparer.OrdinalIgnoreCase);
			Int32 intSecondPos = m_lstPluginOrder.IndexOf(strLoadSecond, StringComparer.OrdinalIgnoreCase);
			if (intFirstPos > -1)
			{
				if (intFirstPos <= intSecondPos)
					return;
				if (intSecondPos > -1)
					m_lstPluginOrder.Remove(strLoadSecond);
				m_lstPluginOrder.Insert(intFirstPos + 1, strLoadSecond);
				return;
			}
			if (intSecondPos < 0)
			{
				intSecondPos = m_lstPluginOrder.Count;
				m_lstPluginOrder.Add(strLoadSecond);
			}
			m_lstPluginOrder.Insert(intSecondPos, strLoadFirst);
		}

		/// <summary>
		/// Ensures that one plugin is loaded after another.
		/// </summary>
		/// <param name="p_strLoadFirst">The plugin to load after the other specified plugin.</param>
		/// <param name="p_strLoadSecond">The plugin after which to load the other specified plugin.</param>
		public void LoadAfter(string p_strLoadSecond, string p_strLoadFirst)
		{
			string strLoadSecond = Path.GetFileName(p_strLoadSecond);
			string[] strFiles = FunctionProxy.GetModFileList();
			if (!strFiles.Contains(x => x.Equals(strLoadSecond, StringComparison.OrdinalIgnoreCase)))
				return;
			string strLoadFirst = Path.GetFileName(p_strLoadFirst);
			Int32 intFirstPos = m_lstPluginOrder.IndexOf(strLoadFirst, StringComparer.OrdinalIgnoreCase);
			Int32 intSecondPos = m_lstPluginOrder.IndexOf(strLoadSecond, StringComparer.OrdinalIgnoreCase);
			if (intSecondPos > -1)
			{
				if (intFirstPos <= intSecondPos)
					return;
				if (intFirstPos > -1)
					m_lstPluginOrder.Remove(strLoadFirst);
				m_lstPluginOrder.Insert(intSecondPos, strLoadFirst);
				return;
			}
			if (intFirstPos < 0)
			{
				intFirstPos = m_lstPluginOrder.Count;
				m_lstPluginOrder.Add(p_strLoadFirst);
			}
			m_lstPluginOrder.Insert(intFirstPos + 1, strLoadSecond);
		}

		/// <summary>
		/// Ensures that the given plugin is loaded early in the load order.
		/// </summary>
		/// <param name="p_strPlugin">The plugin to load early.</param>
		public void LoadEarly(string p_strPlugin)
		{
			string strLoad = Path.GetFileName(p_strPlugin);
			string[] strFiles = FunctionProxy.GetModFileList();
			if (!strFiles.Contains(x => x.Equals(strLoad, StringComparison.OrdinalIgnoreCase)))
				return;
			m_lstPluginOrder.Remove(p_strPlugin);
			m_lstPluginOrder.Insert(0, strLoad);
		}

		#endregion

		#region Math

		/// <summary>
		/// Evaluates the given mathematical expression, and stores the result in the specified variable.
		/// </summary>
		/// <param name="p_strExpression">The expression to evaluate. The array is joined into a single string before evaluation.</param>
		public void iSet(params string[] p_strExpression)
		{
			string strVariableName = p_strExpression[0];
			string strExpression = String.Join(" ", p_strExpression, 1, p_strExpression.Length - 1).Replace("mod", "%");
			SetVar(strVariableName, FunctionProxy.Calculate(strExpression));
		}

		/// <summary>
		/// Evaluates the given mathematical expression, and stores the result in the specified variable.
		/// </summary>
		/// <remarks>
		/// This is an alias for <see cref="iSet"/>.
		/// </remarks>
		/// <param name="p_strExpression">The expression to evaluate. The array is joined into a single string before evaluation.</param>
		/// <seealso cref="iSet"/>
		public void fSet(params string[] p_strExpression)
		{
			iSet(p_strExpression);
		}

		#endregion
	}
}
