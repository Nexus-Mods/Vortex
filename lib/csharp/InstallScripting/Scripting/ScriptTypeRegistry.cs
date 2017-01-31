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

        private static List<string> SupportedScriptDLLs = new List<string>()
        {
            "XmlScript.dll",
            "ModScript.dll",
            "CSharpScript.dll"
        };

        #endregion

        /// <summary>
        /// Searches for script type assemblies in the specified path, and loads
        /// any script types that are found into a registry.
        /// </summary>
        /// <remarks>
        /// A script type is loaded if the class implements <see cref="IScriptType"/> and is
        /// not abstract. Once loaded, the type is added to the registry.
        /// </remarks>
        /// <param name="searchPath">The path in which to search for script type assemblies.</param>
        /// <returns>A registry containing all of the discovered script types.</returns>
        public static IScriptTypeRegistry DiscoverScriptTypes(string searchPath)
		{
            // ??? Do we still need to handle it this way?
			Trace.TraceInformation("Discovering Script Types...");
			Trace.Indent();

			Trace.TraceInformation("Discovering Generic Script Types...");
			Trace.Indent();
			Trace.TraceInformation("Looking in: {0}", searchPath);
			IScriptTypeRegistry TypeRegistry = new ScriptTypeRegistry();
			if (!FileSystem.DirectoryExists(searchPath))
			{
				Trace.TraceError("Script Type search path does not exist.");
				Trace.Unindent();
				Trace.Unindent();
				return TypeRegistry;
			}
			string[] Assemblies = FileSystem.GetFiles(searchPath, "*.dll", SearchOption.AllDirectories);
			RegisterScriptTypes(TypeRegistry, Assemblies);
			Trace.Unindent();

			return TypeRegistry;
		}

        /// <summary>
        /// Searches the given list of assemblies for script types, and registers any that are found.
        /// </summary>
        /// <param name="scriptTypeRegistry">The registry with which to register any found script types.</param>
        /// <param name="scriptAssemblies">The assemblies to search for script types.</param>
        private static void RegisterScriptTypes(IScriptTypeRegistry scriptTypeRegistry, IEnumerable<string> scriptAssemblies)
		{
			AppDomain.CurrentDomain.AssemblyResolve += new ResolveEventHandler(CurrentDomain_AssemblyResolve);
			try
			{
				foreach (string assembly in scriptAssemblies)
				{
					Trace.TraceInformation("Checking: {0}", Path.GetFileName(assembly));
					Trace.Indent();

					if (SupportedScriptDLLs.Contains(Path.GetFileName(assembly)))
					{
						Assembly CurrentAssembly = Assembly.LoadFrom(assembly);
						Type[] Types = CurrentAssembly.GetExportedTypes();
						foreach (Type type in Types)
						{
							if (typeof(IScriptType).IsAssignableFrom(type) && !type.IsAbstract)
							{
								Trace.TraceInformation("Initializing: {0}", type.FullName);
								Trace.Indent();

								IScriptType ScriptType = null;
								ConstructorInfo Constructor = type.GetConstructor(new Type[] { });
								if (Constructor != null)
                                    ScriptType = (IScriptType)Constructor.Invoke(null);
								if (ScriptType != null)
                                    scriptTypeRegistry.RegisterType(ScriptType);

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
			foreach (Assembly loadedAssembly in AppDomain.CurrentDomain.GetAssemblies())
				if (loadedAssembly.FullName == args.Name)
					return loadedAssembly;
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
        /// <param name="scriptType">A <see cref="IScriptType"/> to register.</param>
        public void RegisterType(IScriptType scriptType)
		{
			ScriptTypes[scriptType.TypeId] = scriptType;
		}

        /// <summary>
        /// Gets the specified <see cref="IScriptType"/>.
        /// </summary>
        /// <param name="scriptTypeId">The id of the <see cref="IScriptType"/> to retrieve.</param>
        /// <returns>The <see cref="IScriptType"/> whose id matches the given id. <c>null</c> is returned
        /// if no <see cref="IScriptType"/> with the given id is in the registry.</returns>
        public IScriptType GetType(string scriptTypeId)
		{
			IScriptType Type = null;
			ScriptTypes.TryGetValue(scriptTypeId, out Type);
			return Type;
		}
	}
}
