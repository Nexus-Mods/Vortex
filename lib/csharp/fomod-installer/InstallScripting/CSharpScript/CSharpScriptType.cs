using System;
using System.Collections.Generic;
using System.CodeDom.Compiler;
using System.Threading;
using FomodInstaller.Interface;

namespace FomodInstaller.Scripting.CSharpScript
{
	/// <summary>
	/// Describes the C# script type.
	/// </summary>
	/// <remarks>
	/// This is the script that allows scripting using the C# language. It is meant
	/// to be the most advanced and flexible script.
	/// </remarks>
	public class CSharpScriptType : IScriptType
	{
		private static List<string> m_lstFileNames = new List<string>() { "script.cs" };

		#region IScriptType Members

		/// <summary>
		/// Gets the name of the script type.
		/// </summary>
		/// <value>The name of the script type.</value>
		public string TypeName
		{
			get
			{
				return "C# Script";
			}
		}

		/// <summary>
		/// Gets the unique id of the script type.
		/// </summary>
		/// <value>The unique id of the script type.</value>
		public string TypeId
		{
			get
			{
				return "CSharpScript";
			}
		}

		/// <summary>
		/// Gets the list of file names used by scripts of the current type.
		/// </summary>
		/// <remarks>
		/// The list is in order of preference, with the first item being the preferred
		/// file name.
		/// </remarks>
		/// <value>The list of file names used by scripts of the current type.</value>
		public IList<string> FileNames
		{
			get
			{
				return m_lstFileNames;
			}
		}

        /// <summary>
        /// Creates an executor that can run the script type.
        /// </summary>
        /// <param name="modArchive">The mod being installed.</param>
        /// <param name="delegates">delegates for communicating with the application core.</param>
        /// <returns>An executor that can run the script type.</returns>
        public IScriptExecutor CreateExecutor(Mod modArchive, CoreDelegates delegates)
		{
			CSharpScriptFunctionProxy csfFunctions = GetScriptFunctionProxy(modArchive, delegates);
			return new CSharpScriptExecutor(csfFunctions, BaseScriptType);
		}

		/// <summary>
		/// Loads the script from the given text representation.
		/// </summary>
		/// <param name="p_strScriptData">The text to convert into a script.</param>
		/// <returns>The <see cref="IScript"/> represented by the given data.</returns>
		public IScript LoadScript(string p_strScriptData)
		{
			return new CSharpScript(this, p_strScriptData);
		}

		/// <summary>
		/// Saves the given script into a text representation.
		/// </summary>
		/// <param name="p_scpScript">The <see cref="IScript"/> to save.</param>
		/// <returns>The text represnetation of the given <see cref="IScript"/>.</returns>
		public string SaveScript(IScript p_scpScript)
		{
			return ((CSharpScript)p_scpScript).Code;
		}

		/// <summary>
		/// Determines if the given script is valid.
		/// </summary>
		/// <param name="p_scpScript">The script to validate.</param>
		/// <returns><c>true</c> if the given script is valid;
		/// <c>false</c> otherwise.</returns>
		public bool ValidateScript(IScript p_scpScript)
		{
			CSharpScriptCompiler sccCompiler = new CSharpScriptCompiler();
			CompilerErrorCollection cecErrors = null;
			sccCompiler.Compile(((CSharpScript)p_scpScript).Code, BaseScriptType, out cecErrors);
			return cecErrors == null;
		}

		#endregion

		#region Properties

		/// <summary>
		/// Gets the type of the base script for all C# scripts.
		/// </summary>
		/// <value>The type of the base script for all C# scripts.</value>
		protected virtual Type BaseScriptType
		{
			get
			{
				return typeof(CSharpBaseScript);
			}
		}

        #endregion

        /// <summary>
        /// Returns a proxy that implements the functions available to C# scripts.
        /// </summary>
        /// <param name="scriptedMod">The mod being installed.</param>
        /// <param name="coreDelegates">The Core delegates component.</param>
        /// <returns>A proxy that implements the functions available to C# scripts.</returns>
        protected virtual CSharpScriptFunctionProxy GetScriptFunctionProxy(Mod scriptedMod, CoreDelegates coreDelegates)
		{
			return new CSharpScriptFunctionProxy(scriptedMod, coreDelegates);
		}
	}
}
