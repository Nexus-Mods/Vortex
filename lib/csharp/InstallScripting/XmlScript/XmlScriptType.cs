using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;
using System.Xml.Schema;
using Components.Scripting;
using Nexus.Client.ModManagement.Scripting.XmlScript.CPL;
using Nexus.Client.ModManagement.Scripting.XmlScript.Parsers;
using Nexus.Client.ModManagement.Scripting.XmlScript.Unparsers;
using Nexus.Client.ModManagement.Scripting.XmlScript.Xml;
using System.Threading;

namespace Nexus.Client.ModManagement.Scripting.XmlScript
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
		private static Version[] m_verScriptVersions = { new Version(1, 0),
														new Version(2, 0),
														new Version(3, 0),
														new Version(4, 0),
														new Version(5, 0) };
		private static List<string> m_lstFileNames = new List<string>() { "script.xml", "ModuleConfig.xml" };

		/// <summary>
		/// Gets the list of available script versions.
		/// </summary>
		/// <value>The list of available script versions.</value>
		public static Version[] ScriptVersions
		{
			get
			{
				return m_verScriptVersions;
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
				return m_lstFileNames;
			}
		}

		/// <summary>
		/// Creates an executor that can run the script type.
		/// </summary>
		/// <param name="p_modMod">The mod being installed.</param>
		/// <param name="p_gmdGameMode">The game mode currently bieng managed.</param>
		/// <param name="p_eifEnvironmentInfo">The application's envrionment info.</param>
		/// <param name="p_igpInstallers">The utility class to use to install the mod items.</param>
		/// <param name="p_scxUIContext">The <see cref="SynchronizationContext"/> to use to marshall UI interactions to the UI thread.</param>
		/// <returns>An executor that can run the script type.</returns>
		public IScriptExecutor CreateExecutor(SynchronizationContext p_scxUIContext)
		{
			return new XmlScriptExecutor(p_scxUIContext);
		}

		/// <summary>
		/// Loads the script from the given text representation.
		/// </summary>
		/// <param name="p_strScriptData">The text to convert into a script.</param>
		/// <returns>The <see cref="IScript"/> represented by the given data.</returns>
		public IScript LoadScript(string p_strScriptData)
		{
			XElement xelScript = XElement.Parse(p_strScriptData);
			IParser prsParser = GetParser(xelScript);
			return prsParser.Parse();
		}

		/// <summary>
		/// Saves the given script into a text representation.
		/// </summary>
		/// <param name="p_scpScript">The <see cref="IScript"/> to save.</param>
		/// <returns>The text represnetation of the given <see cref="IScript"/>.</returns>
		public string SaveScript(IScript p_scpScript)
		{
			IUnparser upsUnparser = GetUnparser((XmlScript)p_scpScript);
			XElement xelScript = upsUnparser.Unparse();
			return xelScript.ToString();
		}

		/// <summary>
		/// Determines if the given script is valid.
		/// </summary>
		/// <param name="p_scpScript">The script to validate.</param>
		/// <returns><c>true</c> if the given script is valid;
		/// <c>false</c> otherwise.</returns>
		public bool ValidateScript(IScript p_scpScript)
		{
			IUnparser upsUnparser = GetUnparser((XmlScript)p_scpScript);
			XElement xelScript = upsUnparser.Unparse();
			return IsXmlScriptValid(xelScript);
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
				return "Nexus/Client/ModManagement/Scripting/XmlScript/Schemas";
			}
		}

		#endregion

		/// <summary>
		/// Gets the path to the schema file for the specified xml script version.
		/// </summary>
		/// <param name="p_verXmlScriptVersion">The XML script file version for which to return a schema.</param>
		/// <returns>The path to the schema file for the specified xml script version.</returns>
		public XmlSchema GetXmlScriptSchema(Version p_verXmlScriptVersion)
		{
			Assembly asmAssembly = Assembly.GetAssembly(this.GetType());
			XmlSchema xscSchema = null;
			string strScriptVersion = String.Format("{0}.{1}", p_verXmlScriptVersion.Major, p_verXmlScriptVersion.Minor);
			string strSourcePath = String.Format(Path.Combine(GameSpecificXMLScriptSchemaPath, "XmlScript{0}.xsd").Replace(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar), strScriptVersion);
			string strSourceQualifiedName = strSourcePath.Replace(Path.AltDirectorySeparatorChar, '.');
			if (!Array.Exists(asmAssembly.GetManifestResourceNames(), (s) => { return strSourceQualifiedName.Equals(s, StringComparison.OrdinalIgnoreCase); }))
			{
				asmAssembly = Assembly.GetExecutingAssembly();
				strSourcePath = String.Format("Nexus/Client/Games/data/XmlScript{0}.xsd", strScriptVersion);
				strSourceQualifiedName = strSourcePath.Replace(Path.AltDirectorySeparatorChar, '.');
			}
			using (Stream stmSchema = asmAssembly.GetManifestResourceStream(strSourceQualifiedName))
			{
				string strSourceUri = String.Format("assembly://{0}/{1}", asmAssembly.GetName().Name, strSourcePath);
				XmlReaderSettings xrsSettings = new XmlReaderSettings();
				xrsSettings.IgnoreComments = true;
				xrsSettings.IgnoreWhitespace = true;
				using (XmlReader xrdSchemaReader = XmlReader.Create(stmSchema, xrsSettings, strSourceUri))
					xscSchema = XmlSchema.Read(xrdSchemaReader, delegate(object sender, ValidationEventArgs e) { throw e.Exception; });
			}
			return xscSchema;
		}

		#region Script Version Helpers

		/// <summary>
		/// Extracts the config version from a XML configuration file.
		/// </summary>
		protected readonly static Regex m_rgxVersion = new Regex("xsi:noNamespaceSchemaLocation=\"[^\"]*((XmlScript)|(ModConfig))(.*?).xsd", RegexOptions.Singleline);

		/// <summary>
		/// Gets the config version used by the given XML configuration file.
		/// </summary>
		/// <param name="p_strXml">The XML file whose version is to be determined.</param>
		/// <returns>The config version used the given XML configuration file, or <c>null</c>
		/// if the given file is not recognized as a configuration file.</returns>
		public Version GetXmlScriptVersion(string p_strXml)
		{
			string strScriptVersion = "1.0";
			if (m_rgxVersion.IsMatch(p_strXml))
			{
				strScriptVersion = m_rgxVersion.Match(p_strXml).Groups[4].Value;
				if (String.IsNullOrEmpty(strScriptVersion))
					strScriptVersion = "1.0";
			}
			return new Version(strScriptVersion);
		}

		/// <summary>
		/// Gets the config version used by the given XML configuration file.
		/// </summary>
		/// <param name="p_xelScript">The XML file whose version is to be determined.</param>
		/// <returns>The config version used the given XML configuration file, or <c>null</c>
		/// if the given file is not recognized as a configuration file.</returns>
		public Version GetXmlScriptVersion(XElement p_xelScript)
		{
			string strScriptVersion = "1.0";
			XElement xelRoot = p_xelScript.DescendantsAndSelf("config").First();
			string strSchemaName = xelRoot.Attribute(XName.Get("noNamespaceSchemaLocation", "http://www.w3.org/2001/XMLSchema-instance")).Value.ToLowerInvariant();
			Int32 intStartPos = strSchemaName.LastIndexOf("xmlscript") + 9;
			if (intStartPos < 9)
				intStartPos = strSchemaName.LastIndexOf("modconfig") + 9;
			if (intStartPos > 8)
			{
				Int32 intLength = strSchemaName.Length - intStartPos - 4;
				if (intLength > 0)
					strScriptVersion = strSchemaName.Substring(intStartPos, intLength);
			}
			return new Version(strScriptVersion);
		}

		#endregion

		#region Validation

		/// <summary>
		/// Validates the given Xml Script against the appropriate schema.
		/// </summary>
		/// <param name="p_xelScript">The script file.</param>
		public void ValidateXmlScript(XElement p_xelScript)
		{
			XmlSchema xscSchema = GetXmlScriptSchema(GetXmlScriptVersion(p_xelScript));
			XmlSchemaSet xssSchemas = new XmlSchemaSet();
			xssSchemas.XmlResolver = new XmlSchemaResourceResolver();
			xssSchemas.Add(xscSchema);
			xssSchemas.Compile();

			XDocument docScript = new XDocument(p_xelScript);
			docScript.Validate(xssSchemas, null, true);
		}

		/// <summary>
		/// Validates the given Xml Script against the appropriate schema.
		/// </summary>
		/// <param name="p_xelScript">The script file.</param>
		/// <returns><c>true</c> if the given script is valid;
		/// <c>false</c> otherwise.</returns>
		public bool IsXmlScriptValid(XElement p_xelScript)
		{
			try
			{
				ValidateXmlScript(p_xelScript);
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
