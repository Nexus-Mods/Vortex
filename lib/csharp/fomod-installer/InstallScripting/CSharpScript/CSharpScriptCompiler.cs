using System;
using System.CodeDom.Compiler;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using Microsoft.CSharp;

namespace FomodInstaller.Scripting.CSharpScript
{
	/// <summary>
	/// Compiles C# scripts into executable assemblies.
	/// </summary>
	public class CSharpScriptCompiler
	{
		/// <summary>
		/// Compiles the given code into an assembly.
		/// </summary>
		/// <remarks>
		/// The compiled assembly is not loaded into the current app domain.
		/// </remarks>
		/// <param name="p_strCode">The C# code to compile</param>
		/// <param name="p_tpeBaseScriptType">The type of the base script from which the class in the code derives.</param>
		/// <param name="p_cecErrors">The collection in which to return any compilation errors.</param>
		/// <returns>The bytes of the compiled assembly.</returns>
		public byte[] Compile(string p_strCode, Type p_tpeBaseScriptType, out CompilerErrorCollection p_cecErrors)
		{
			Dictionary<string, string> dicOptions = new Dictionary<string, string>();
			dicOptions["CompilerVersion"] = "v4.0";
			CSharpCodeProvider ccpProvider = new CSharpCodeProvider(dicOptions);
			CompilerParameters cpmOptions = new CompilerParameters();
			cpmOptions.GenerateExecutable = false;
			cpmOptions.GenerateInMemory = false;
			cpmOptions.OutputAssembly = Path.GetTempFileName();
			cpmOptions.IncludeDebugInformation = false;
			cpmOptions.ReferencedAssemblies.Add("System.dll");
			cpmOptions.ReferencedAssemblies.Add("System.Drawing.dll");
			cpmOptions.ReferencedAssemblies.Add("System.Windows.Forms.dll");
			cpmOptions.ReferencedAssemblies.Add("System.Xml.dll");

			//reference the assemblies we need for the base script
			List<string> setAssemblies = new List<string>();
			Type tpeReference = p_tpeBaseScriptType;
			while (tpeReference != null)
			{
				setAssemblies.Add(Assembly.GetAssembly(tpeReference).Location);
				tpeReference = tpeReference.BaseType;
			}
			foreach (string strReference in setAssemblies)
				cpmOptions.ReferencedAssemblies.Add(strReference);

			CompilerResults crsResults = ccpProvider.CompileAssemblyFromSource(cpmOptions, p_strCode);
			p_cecErrors = null;
			if (crsResults.Errors.HasErrors || crsResults.Errors.HasWarnings)
			{
				p_cecErrors = crsResults.Errors;
				return null;
			}
			byte[] bteAssembly = File.ReadAllBytes(crsResults.PathToAssembly);
			return bteAssembly;
		}
	}
}
