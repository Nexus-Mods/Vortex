using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;
using System.Threading;
using System.Xml;
using System.Xml.Linq;
using System.Xml.Schema;
using FomodInstaller.Scripting.XmlScript.Parsers;
using FomodInstaller.Scripting.XmlScript.Unparsers;
using FomodInstaller.Scripting.XmlScript.Xml;
using FomodInstaller.Interface;

namespace FomodInstaller.Scripting.XmlScript
{
	/// <summary>
	/// Describes the XML script type.
	/// </summary>
	/// <remarks>
	/// This is the script that allows scripting using an XML language. It is meant
	/// to be easier to learn and more accessible than the more advanced C# script.
	/// </remarks>
	public class XmlScriptType : IScriptType
	{
		private static Version[] SupportedScriptVersions = { new Version(1, 0),
														new Version(2, 0),
														new Version(3, 0),
														new Version(4, 0),
														new Version(5, 0) };
		private static List<string> ListFileNames = new List<string>() { "script.xml", "ModuleConfig.xml" };

		/// <summary>
		/// Gets the list of available script versions.
		/// </summary>
		/// <value>The list of available script versions.</value>
		public static Version[] ScriptVersions
		{
			get
			{
				return SupportedScriptVersions;
			}
		}

		#region IScriptType Members

		/// <summary>
		/// Gets the name of the script type.
		/// </summary>
		/// <value>The name of the script type.</value>
		public string TypeName
		{
			get
			{
				return "XML Script";
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
				return "XmlScript";
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
				return ListFileNames;
			}
		}

        /// <summary>
        /// Creates an executor that can run the script type.
        /// </summary>
        /// <param name="modArchive">The mod being installed.</param>
        /// <param name="delegates">The application's envrionment info.</param>
        /// <returns>An executor that can run the script type.</returns>
        public IScriptExecutor CreateExecutor(Mod modArchive, CoreDelegates delegates)
		{
			return new XmlScriptExecutor(modArchive, delegates);
		}

		/// <summary>
		/// Loads the script from the given text representation.
		/// </summary>
		/// <param name="p_strScriptData">The text to convert into a script.</param>
		/// <returns>The <see cref="IScript"/> represented by the given data.</returns>
		public IScript LoadScript(string scriptData)
		{
			XElement XelScript = XElement.Parse(scriptData);
			IParser Parser = GetParser(XelScript);
			return Parser.Parse();
		}

		/// <summary>
		/// Saves the given script into a text representation.
		/// </summary>
		/// <param name="p_scpScript">The <see cref="IScript"/> to save.</param>
		/// <returns>The text represnetation of the given <see cref="IScript"/>.</returns>
		public string SaveScript(IScript script)
		{
			IUnparser Unparser = GetUnparser((XmlScript)script);
			XElement XelScript = Unparser.Unparse();
			return XelScript.ToString();
		}

		/// <summary>
		/// Determines if the given script is valid.
		/// </summary>
		/// <param name="p_scpScript">The script to validate.</param>
		/// <returns><c>true</c> if the given script is valid;
		/// <c>false</c> otherwise.</returns>
		public bool ValidateScript(IScript script)
		{
			IUnparser Unparser = GetUnparser((XmlScript)script);
			XElement XelScript = Unparser.Unparse();
			return IsXmlScriptValid(XelScript);
		}

		#endregion

		#region Properties

		/// <summary>
		/// Gets the path to the game-specific xml script schema files.
		/// </summary>
		/// <value>The path to the game-specific xml script schema files.</value>
		protected virtual string GameSpecificXMLScriptSchemaPath
		{
			get
			{
				return "FomodInstaller/Scripting/XmlScript/Schemas";
			}
		}

		#endregion

		/// <summary>
		/// Gets the path to the schema file for the specified xml script version.
		/// </summary>
		/// <param name="XmlScriptVersion">The XML script file version for which to return a schema.</param>
		/// <returns>The path to the schema file for the specified xml script version.</returns>
		public XmlSchema GetXmlScriptSchema(Version XmlScriptVersion)
		{
			Assembly Assembly = Assembly.GetAssembly(GetType());
			XmlSchema XMLSchema = null;
			string ScriptVersion = string.Format("{0}.{1}", XmlScriptVersion.Major, XmlScriptVersion.Minor);
			string SourcePath = string.Format(Path.Combine(GameSpecificXMLScriptSchemaPath, "XmlScript{0}.xsd").Replace(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar), ScriptVersion);
			string SourceQualifiedName = SourcePath.Replace(Path.AltDirectorySeparatorChar, '.');
			if (!Array.Exists(Assembly.GetManifestResourceNames(), (s) => { return SourceQualifiedName.Equals(s, StringComparison.OrdinalIgnoreCase); }))
			{
                Assembly = Assembly.GetExecutingAssembly();
				SourcePath = string.Format("FomodInstaller/Scripting/XmlScript/Schemas/XmlScript{0}.xsd", ScriptVersion);
				SourceQualifiedName = SourcePath.Replace(Path.AltDirectorySeparatorChar, '.');
			}
			using (Stream schema = Assembly.GetManifestResourceStream(SourceQualifiedName))
			{
                string SourceUri = string.Format("assembly://{0}", SourcePath);
                XmlReaderSettings ReaderSettings = new XmlReaderSettings();
				ReaderSettings.IgnoreComments = true;
				ReaderSettings.IgnoreWhitespace = true;
                using (XmlReader schemaReader = XmlReader.Create(schema, ReaderSettings, SourceUri))
					XMLSchema = XmlSchema.Read(schemaReader, delegate(object sender, ValidationEventArgs e) { throw e.Exception; });
			}
			return XMLSchema;
		}

		#region Script Version Helpers

		/// <summary>
		/// Extracts the config version from a XML configuration file.
		/// </summary>
		protected readonly static Regex RegexVersion = new Regex("xsi:noNamespaceSchemaLocation=\"[^\"]*((XmlScript)|(ModConfig))(.*?).xsd", RegexOptions.Singleline);

		/// <summary>
		/// Gets the config version used by the given XML configuration file.
		/// </summary>
		/// <param name="xmlFile">The XML file whose version is to be determined.</param>
		/// <returns>The config version used the given XML configuration file, or <c>null</c>
		/// if the given file is not recognized as a configuration file.</returns>
		public Version GetXmlScriptVersion(string xmlFile)
		{
			string ScriptVersion = "1.0";
			if (RegexVersion.IsMatch(xmlFile))
			{
                ScriptVersion = RegexVersion.Match(xmlFile).Groups[4].Value;
				if (string.IsNullOrEmpty(ScriptVersion))
                    ScriptVersion = "1.0";
			}

			return new Version(ScriptVersion);
		}

        /// <summary>
        /// Gets the config version used by the given XML configuration file.
        /// </summary>
        /// <param name="xmlScript">The XML file whose version is to be determined.</param>
        /// <returns>The config version used the given XML configuration file, or <c>null</c>
        /// if the given file is not recognized as a configuration file.</returns>
        public Version GetXmlScriptVersion(XElement xmlScript)
		{
			string ScriptVersion = "1.0";
			XElement XmlRoot = xmlScript.DescendantsAndSelf("config").First();
			string SchemaName = XmlRoot.Attribute(XName.Get("noNamespaceSchemaLocation", "http://www.w3.org/2001/XMLSchema-instance")).Value.ToLowerInvariant();
			int StartPos = SchemaName.LastIndexOf("xmlscript") + 9;
			if (StartPos < 9)
                StartPos = SchemaName.LastIndexOf("modconfig") + 9;
			if (StartPos > 8)
			{
				int intLength = SchemaName.Length - StartPos - 4;
				if (intLength > 0)
                    ScriptVersion = SchemaName.Substring(StartPos, intLength);
			}
            return new Version(ScriptVersion);
		}

        #endregion

        #region Validation

        /// <summary>
        /// Validates the given Xml Script against the appropriate schema.
        /// </summary>
        /// <param name="xmlScript">The script file.</param>
        public void ValidateXmlScript(XElement xmlScript)
		{
			XmlSchema XMLSchema = GetXmlScriptSchema(GetXmlScriptVersion(xmlScript));
			XmlSchemaSet SchemaSet = new XmlSchemaSet();
            SchemaSet.XmlResolver = new XmlSchemaResourceResolver();
            SchemaSet.Add(XMLSchema);
            SchemaSet.Compile();

			XDocument XDocScript = new XDocument(xmlScript);
            XDocScript.Validate(SchemaSet, null, true);
		}

        /// <summary>
        /// Validates the given Xml Script against the appropriate schema.
        /// </summary>
        /// <param name="xmlScript">The script file.</param>
        /// <returns><c>true</c> if the given script is valid;
        /// <c>false</c> otherwise.</returns>
        public bool IsXmlScriptValid(XElement xmlScript)
		{
			try
			{
				ValidateXmlScript(xmlScript);
			}
			catch (Exception)
			{
				return false;
			}
			return true;
		}

		#endregion

		#region Serialization

		/// <summary>
		/// Gets a parser for the given script.
		/// </summary>
		/// <param name="p_xelScript">The script for which to get a parser.</param>
		/// <returns>A parser for the given script.</returns>
		protected virtual IParser GetParser(XElement p_xelScript)
		{
			string strScriptVersion = GetXmlScriptVersion(p_xelScript).ToString();
			switch (strScriptVersion)
			{
				case "1.0":
					return new Parser10(p_xelScript, this);
				case "2.0":
					return new Parser20(p_xelScript, this);
				case "3.0":
					return new Parser30(p_xelScript, this);
				case "4.0":
					return new Parser40(p_xelScript, this);
				case "5.0":
					return new Parser50(p_xelScript, this);
			}
			throw new ParserException("Unrecognized XML Script version (" + strScriptVersion + "). Perhaps a newer version of the mod manager is required.");
		}

		/// <summary>
		/// Gets a unparser for the given script.
		/// </summary>
		/// <param name="p_xscScript">The script for which to get an unparser.</param>
		/// <returns>An unparser for the given script.</returns>
		protected virtual IUnparser GetUnparser(XmlScript p_xscScript)
		{
			switch (p_xscScript.Version.ToString())
			{
				case "1.0":
					return new Unparser10(p_xscScript);
				case "2.0":
					return new Unparser20(p_xscScript);
				case "3.0":
					return new Unparser30(p_xscScript);
				case "4.0":
					return new Unparser40(p_xscScript);
				case "5.0":
					return new Unparser50(p_xscScript);

			}
			throw new ParserException("Unrecognized XML Script version (" + p_xscScript.Version + "). Perhaps a newer version of the mod manager is required.");
		}

		#endregion

		/// <summary>
		/// The factory method that returns the appropriate <see cref="IXmlScriptNodeAdapter"/> for
		/// the given xml script version.
		/// </summary>
		/// <param name="p_verXmlScriptVersion">The xml script version for which to create an
		/// <see cref="IXmlScriptNodeAdapter"/>.</param>
		/// <returns>The appropriate <see cref="IXmlScriptNodeAdapter"/> for the given xml script version.</returns>
		/// <exception cref="Exception">Thrown if no <see cref="IXmlScriptNodeAdapter"/> is
		/// found for the given xml script version.</exception>
		// ??? public virtual IXmlScriptNodeAdapter GetXmlScriptNodeAdapter(Version p_verXmlScriptVersion)
		//{
		//	switch (p_verXmlScriptVersion.ToString())
		//	{
		//		case "1.0":
		//		case "2.0":
		//		case "3.0":
		//		case "4.0":
		//			throw new Exception(String.Format("Version {0} is not supported without a specific game mode XML script implementation.", p_verXmlScriptVersion));
		//		case "5.0":
		//			return new XmlScript50NodeAdapter(this);
		//	}
		//	throw new Exception("Unrecognized Xml Script version (" + p_verXmlScriptVersion + "). Perhaps a newer version of the client is required.");
		//}

		/// <summary>
		/// Gets a CPL Parser factory.
		/// </summary>
		/// <returns>A CPL Parser factory.</returns>
		public virtual ICplParserFactory GetCplParserFactory()
		{
			return new BaseCplParserFactory();
		}

		/// <summary>
		/// Gets the commands supported by the specified XML Script version.
		/// </summary>
		/// <param name="p_verXmlScriptVersion">The XML script file version for which to return a schema.</param>
		/// <returns>The commands supported by the specified XML Script version.</returns>
		// ??? public XmlScriptEditCommands GetSupportedXmlScriptEditCommands(Version p_verXmlScriptVersion)
		//{
		//	switch (p_verXmlScriptVersion.ToString())
		//	{
		//		case "1.0":
		//			return XmlScriptEditCommands.AddOptionGroup | XmlScriptEditCommands.AddOption;
		//		case "2.0":
		//		case "3.0":
		//			return XmlScriptEditCommands.AddOptionGroup | XmlScriptEditCommands.AddOption | XmlScriptEditCommands.AddConditionallyInstalledFileSet;
		//		case "4.0":
		//		case "5.0":
		//			return XmlScriptEditCommands.AddOptionGroup | XmlScriptEditCommands.AddOption | XmlScriptEditCommands.AddConditionallyInstalledFileSet | XmlScriptEditCommands.AddInstallStep;
		//	}
		//	throw new Exception("Unrecognized Xml Script version (" + p_verXmlScriptVersion + "). Perhaps a newer version of the client is required.");
		//}

		/// <summary>
		/// Creates a <see cref="ConditionStateManager"/> to use when running an XML script.
		/// </summary>
		/// <param name="p_modMod">The mod being installed.</param>
		/// <param name="p_gmdGameMode">The game mode currently bieng managed.</param>
		/// <param name="p_pmgPluginManager">The plugin manager.</param>
		/// <param name="p_eifEnvironmentInfo">The application's envrionment info.</param>
		/// <returns>A <see cref="ConditionStateManager"/> to use when running an XML script.</returns>
		public virtual ConditionStateManager CreateConditionStateManager()
		{
			return new ConditionStateManager();
		}
	}
}
