using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using Utils;

namespace Components.Scripting
{
	/// <summary>
	/// A registry of all supported mod script types.
	/// </summary>
	public class ScriptTypeRegistry : IScriptTypeRegistry
	{
        #region Fields

        protected static FileSystem FileSystem;

        #endregion

        /// <summary>
        /// Searches for script type assemblies in the specified path, and loads
        /// any script types that are found into a registry.
        /// </summary>
        /// <remarks>
        /// A script type is loaded if the class implements <see cref="IScriptType"/> and is
        /// not abstract. Once loaded, the type is added to the registry.
        /// </remarks>
        /// <param name="p_strSearchPath">The path in which to search for script type assemblies.</param>
        /// <param name="p_gmdGameMode">The current game mode.</param>
        /// <returns>A registry containing all of the discovered script types.</returns>
        public static IScriptTypeRegistry DiscoverScriptTypes(string p_strSearchPath, List<string> p_lstDeletedDLL)
		{
			Trace.TraceInformation("Discovering Script Types...");
			Trace.Indent();

			Trace.TraceInformation("Discovering Generic Script Types...");
			Trace.Indent();
			Trace.TraceInformation("Looking in: {0}", p_strSearchPath);
			IScriptTypeRegistry stgRegistry = new ScriptTypeRegistry();
			if (!FileSystem.DirectoryExists(p_strSearchPath))
			{
				Trace.TraceError("Script Type search path does not exist.");
				Trace.Unindent();
				Trace.Unindent();
				return stgRegistry;
			}
			string[] strAssemblies = FileSystem.GetFiles(p_strSearchPath, "*.dll", System.IO.SearchOption.AllDirectories);
			RegisterScriptTypes(stgRegistry, strAssemblies, p_lstDeletedDLL);
			Trace.Unindent();

			Trace.TraceInformation("Discovering Game Mode Specific Script Types...");
			Trace.Indent();
            /// Set path to the folder containing scripted installer dlls
			string strGameModeSearchPath = Path.GetDirectoryName(p_strSearchPath);
			Trace.TraceInformation("Looking in: {0}", strGameModeSearchPath);
			if (!FileSystem.DirectoryExists(strGameModeSearchPath))
			{
				Trace.TraceError("Game Mode Specific Script Type search path does not exist.");
				Trace.Unindent();
				Trace.Unindent();
				return stgRegistry;
			}
			List<string> lstAssemblies = new List<string>();
			foreach (IScriptType stpType in stgRegistry.Types)
				lstAssemblies.AddRange(FileSystem.GetFiles(strGameModeSearchPath, string.Format("{0}.dll", stpType.TypeId), System.IO.SearchOption.AllDirectories));
			RegisterScriptTypes(stgRegistry, lstAssemblies, p_lstDeletedDLL);
			Trace.Unindent();

			Trace.Unindent();
			return stgRegistry;
		}

		/// <summary>
		/// Searches the given list of assemblies for script types, and registers any that are found.
		/// </summary>
		/// <param name="p_stgScriptTypeRegistry">The registry with which to register any found script types.</param>
		/// <param name="p_enmAssemblies">The assemblies to search for script types.</param>
		private static void RegisterScriptTypes(IScriptTypeRegistry p_stgScriptTypeRegistry, IEnumerable<string> p_enmAssemblies, List<string> p_lstRemovedDLL)
		{
			AppDomain.CurrentDomain.AssemblyResolve += new ResolveEventHandler(CurrentDomain_AssemblyResolve);
			try
			{
				foreach (string strAssembly in p_enmAssemblies)
				{
					Trace.TraceInformation("Checking: {0}", Path.GetFileName(strAssembly));
					Trace.Indent();

					if (!p_lstRemovedDLL.Contains(Path.GetFileName(strAssembly)))
					{
						Assembly asmGameMode = Assembly.LoadFrom(strAssembly);
						Type[] tpeTypes = asmGameMode.GetExportedTypes();
						foreach (Type tpeType in tpeTypes)
						{
							if (typeof(IScriptType).IsAssignableFrom(tpeType) && !tpeType.IsAbstract)
							{
								Trace.TraceInformation("Initializing: {0}", tpeType.FullName);
								Trace.Indent();

								IScriptType sctScriptType = null;
								ConstructorInfo cifConstructor = tpeType.GetConstructor(new Type[] { });
								if (cifConstructor != null)
									sctScriptType = (IScriptType)cifConstructor.Invoke(null);
								if (sctScriptType != null)
									p_stgScriptTypeRegistry.RegisterType(sctScriptType);

								Trace.Unindent();
							}
						}
					}
					Trace.Unindent();
				}
			}
			finally
			{
				AppDomain.CurrentDomain.AssemblyResolve -= CurrentDomain_AssemblyResolve;
			}
		}

		/// <summary>
		/// Handles the <see cref="AppDomain.AssemblyResolve"/> event.
		/// </summary>
		/// <remarks>
		/// Assemblies that have been load dynamically aren't accessible by assembly name. So, when, for example,
		/// Fallout3.XmlScript.dll looks for the XmlScript.dll assembly on which it is dependent, it looks for
		/// "XmlScript" (the name of the assembly), but can't find it. This handler searches through loaded
		/// assemblies and finds the required assembly.
		/// </remarks>
		/// <param name="sender">The object that raised the event.</param>
		/// <param name="args">A <see cref="ResolveEventArgs"/> describing the event arguments.</param>
		/// <returns>The assembly being looked for, or <c>null</c> if the assembly cannot
		/// be found.</returns>
		private static Assembly CurrentDomain_AssemblyResolve(object sender, ResolveEventArgs args)
		{
			foreach (Assembly asmLoaded in AppDomain.CurrentDomain.GetAssemblies())
				if (asmLoaded.FullName == args.Name)
					return asmLoaded;
			return null;
		}

		#region Properties

		/// <summary>
		/// Gets or sets the list of registered <see cref="IScriptType"/>s.
		/// </summary>
		/// <value>The list of registered <see cref="IScriptType"/>s.</value>
		protected Dictionary<string, IScriptType> ScriptTypes { get; set; }

		/// <summary>
		/// Gets the registered <see cref="IScriptType"/>s.
		/// </summary>
		/// <value>The registered <see cref="IScriptType"/>s.</value>
		public ICollection<IScriptType> Types
		{
			get
			{
				return ScriptTypes.Values;
			}
		}

		#endregion

		#region Constructors

		/// <summary>
		/// The default constructor.
		/// </summary>
		public ScriptTypeRegistry()
		{
			ScriptTypes = new Dictionary<string, IScriptType>();
		}

		#endregion

		/// <summary>
		/// Registers the given <see cref="IScriptType"/>.
		/// </summary>
		/// <param name="p_stpType">A <see cref="IScriptType"/> to register.</param>
		public void RegisterType(IScriptType p_stpType)
		{
			ScriptTypes[p_stpType.TypeId] = p_stpType;
		}

		/// <summary>
		/// Gets the specified <see cref="IScriptType"/>.
		/// </summary>
		/// <param name="p_strScriptTypeId">The id of the <see cref="IScriptType"/> to retrieve.</param>
		/// <returns>The <see cref="IScriptType"/> whose id matches the given id. <c>null</c> is returned
		/// if no <see cref="IScriptType"/> with the given id is in the registry.</returns>
		public IScriptType GetType(string p_strScriptTypeId)
		{
			IScriptType stpType = null;
			ScriptTypes.TryGetValue(p_strScriptTypeId, out stpType);
			return stpType;
		}
	}
}
