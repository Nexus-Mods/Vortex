using System;
using System.Collections.Generic;
using System.Linq;
using System.Xml.Linq;
using System.Xml.Schema;
using System.Xml.XPath;

namespace Nexus.Client.ModManagement.Scripting.XmlScript.Parsers
{
	/// <summary>
	/// Parses version 2.0 xml script files.
	/// </summary>
	public class Parser20 : Parser10
	{
		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_xelScript">The xmlscript file.</param>
		/// <param name="p_xstXmlScriptType">The <see cref="XmlScriptType"/> that describes
		/// XML script type metadata.</param>
		public Parser20(XElement p_xelScript, XmlScriptType p_xstXmlScriptType)
			: base(p_xelScript, p_xstXmlScriptType)
		{
		}

		#endregion

		#region Abstract Method Implementations

		/// <summary>
		/// Parses <see cref="XmlScript.ModPrerequisites"/>.
		/// </summary>
		/// <returns>The script's <see cref="XmlScript.ModPrerequisites"/>, based on the XML,
		/// or <c>null</c> if the XML doesn't describe any <see cref="XmlScript.ModPrerequisites"/>.</returns>
		protected override ICondition GetModPrerequisites()
		{
			CompositeCondition cpcCondition = new CompositeCondition(ConditionOperator.And);
			IEnumerable<XElement> xeeDependencies = Script.XPathSelectElements("moduleDependencies/*");
			foreach (XElement xelCondition in xeeDependencies)
				cpcCondition.Conditions.Add(LoadCondition(xelCondition));
			return cpcCondition;
		}

		/// <summary>
		/// Parses <see cref="XmlScript.ConditionallyInstalledFileSets"/>.
		/// </summary>
		/// <returns>A <see cref="Script"/>'s <see cref="XmlScript.ConditionallyInstalledFileSets"/>, based on the XML,
		/// or <c>null</c> if the script doesn't describe any <see cref="XmlScript.ConditionallyInstalledFileSets"/>.</returns>
		protected override List<ConditionallyInstalledFileSet> GetConditionallyInstalledFileSets()
		{
			IEnumerable<XElement> xeeRequiredInstallFiles = Script.XPathSelectElements("conditionalFileInstalls/patterns/*");
			return ReadConditionalFileInstallInfo(xeeRequiredInstallFiles);
		}

		#endregion

		#region Parsing Methods

		/// <summary>
		/// Reads a option's information from the script file.
		/// </summary>
		/// <param name="p_xelOption">The script file node corresponding to the option to read.</param>
		/// <returns>The option information.</returns>
		protected override Option ParseOption(XElement p_xelOption)
		{
			string strName = p_xelOption.Attribute("name").Value;
			string strDesc = p_xelOption.Element("description").Value.Trim();
			IOptionTypeResolver iptType = null;
			XElement xelTypeDescriptor = p_xelOption.Element("typeDescriptor").Elements().First();
			switch (xelTypeDescriptor.Name.LocalName)
			{
				case "type":
					iptType = new StaticOptionTypeResolver((OptionType)Enum.Parse(typeof(OptionType), xelTypeDescriptor.Attribute("name").Value));
					break;
				case "dependencyType":
					OptionType ptpDefaultType = (OptionType)Enum.Parse(typeof(OptionType), xelTypeDescriptor.Element("defaultType").Attribute("name").Value);
					iptType = new ConditionalOptionTypeResolver(ptpDefaultType);
					ConditionalOptionTypeResolver cotConditionalType = (ConditionalOptionTypeResolver)iptType;

					IEnumerable<XElement> xeePatterns = xelTypeDescriptor.XPathSelectElements("patterns/*");
					foreach (XElement xelPattern in xeePatterns)
					{
						OptionType ptpType = (OptionType)Enum.Parse(typeof(OptionType), xelPattern.Element("type").Attribute("name").Value);
						ICondition cpcCondition = LoadCondition(xelPattern.Element("dependencies"));
						cotConditionalType.AddPattern(ptpType, cpcCondition);
					}
					break;
				default:
					throw new ParserException("Invalid option type descriptor node: " + xelTypeDescriptor.Name + ". At this point the config file has been validated against the schema, so there's something wrong with the parser.");
			}
			XElement xelImage = p_xelOption.Element("image");
			string strImageFilePath = null;
			if (xelImage != null)
				strImageFilePath = xelImage.Attribute("path").Value;
			Option optOption = new Option(strName, strDesc, strImageFilePath, iptType);

			IEnumerable<XElement> xeeOptionFiles = p_xelOption.XPathSelectElements("files/*");
			optOption.Files.AddRange(ReadFileInfo(xeeOptionFiles));

			IEnumerable<XElement> xeePluginFlags = p_xelOption.XPathSelectElements("conditionFlags/*");
			optOption.Flags.AddRange(ReadFlagInfo(xeePluginFlags));
			
			return optOption;
		}

		/// <summary>
		/// Reads the dependency information from the given node.
		/// </summary>
		/// <param name="p_xelCondition">The node from which to load the dependency information.</param>
		/// <returns>A <see cref="CompositeCondition"/> representing the dependency described in the given node.</returns>
		protected override ICondition LoadCondition(XElement p_xelCondition)
		{
			if (p_xelCondition == null)
				return null;
			switch (p_xelCondition.GetSchemaInfo().SchemaType.Name)
			{
				case "compositeDependency":
					ConditionOperator copOperator = (ConditionOperator)Enum.Parse(typeof(ConditionOperator), p_xelCondition.Attribute("operator").Value);
					CompositeCondition cpdCondition = new CompositeCondition(copOperator);
					IEnumerable<XElement> xeeDependencies = p_xelCondition.Elements();
					foreach (XElement xelCondition in xeeDependencies)
						cpdCondition.Conditions.Add(LoadCondition(xelCondition));
					return cpdCondition;
				case "fileDependency":
					string strCondition = p_xelCondition.Attribute("file").Value.ToLower();
					PluginState plsModState = (PluginState)Enum.Parse(typeof(PluginState), p_xelCondition.Attribute("state").Value);
					return new PluginCondition(strCondition, plsModState);
				case "flagDependency":
					string strFlagName = p_xelCondition.Attribute("flag").Value;
					string strValue = p_xelCondition.Attribute("value").Value;
					return new FlagCondition(strFlagName, strValue);
				case "moduleFileDependency":
					string strFileCondition = p_xelCondition.Attribute("file").Value.ToLower();
					return new PluginCondition(strFileCondition, PluginState.Active);
				case "moduleVersionDependency":
					switch (p_xelCondition.Name.LocalName)
					{
						case "falloutDependency":
							Version verMinFalloutVersion = ParseVersion(p_xelCondition.Attribute("version").Value);
							return new GameVersionCondition(verMinFalloutVersion);
						case "fommDependency":
							Version verMinFommVersion = ParseVersion(p_xelCondition.Attribute("version").Value);
							return new ModManagerCondition(verMinFommVersion);
						default:
							throw new ParserException("Invalid dependency node: " + p_xelCondition.Name + ". At this point the config file has been validated against the schema, so there's something wrong with the parser.");
					}
				default:
					throw new ParserException("Invalid plugin condition node: " + p_xelCondition.Name + ". At this point the config file has been validated against the schema, so there's something wrong with the parser.");
			}
		}

		/// <summary>
		/// Reads the condtition flag info from the given XML nodes.
		/// </summary>
		/// <param name="p_xeeFlags">The list of XML nodes containing the condition flag info to read.</param>
		/// <returns>An ordered list of <see cref="ConditionalFlag"/>s representing the data in the given list.</returns>
		private List<ConditionalFlag> ReadFlagInfo(IEnumerable<XElement> p_xeeFlags)
		{
			List<ConditionalFlag> lstFlags = new List<ConditionalFlag>();
			foreach (XElement xelFlag in p_xeeFlags)
			{
				string strName = xelFlag.Attribute("name").Value;
				string strValue = xelFlag.Value;
				lstFlags.Add(new ConditionalFlag(strName, strValue));
			}
			return lstFlags;
		}

		/// <summary>
		/// Reads the conditional file install info from the given XML nodes.
		/// </summary>
		/// <param name="p_xeeConditionalFileInstalls">The list of XML nodes containing the conditional file
		/// install info to read.</param>
		/// <returns>An ordered list of <see cref="ConditionallyInstalledFileSet"/>s representing the
		/// data in the given list.</returns>
		private List<ConditionallyInstalledFileSet> ReadConditionalFileInstallInfo(IEnumerable<XElement> p_xeeConditionalFileInstalls)
		{
			List<ConditionallyInstalledFileSet> lstPatterns = new List<ConditionallyInstalledFileSet>();
			foreach (XElement xelPattern in p_xeeConditionalFileInstalls)
			{
				ICondition cndCondition = LoadCondition(xelPattern.Element("dependencies"));
				IList<InstallableFile> lstFiles = ReadFileInfo(xelPattern.XPathSelectElements("files/*"));
				lstPatterns.Add(new ConditionallyInstalledFileSet(cndCondition, lstFiles));
			}
			return lstPatterns;
		}

		#endregion
	}
}
