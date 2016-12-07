using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Xml.Linq;
using System.Xml.Schema;
using System.Xml.XPath;

namespace Nexus.Client.ModManagement.Scripting.XmlScript.Parsers
{
	/// <summary>
	/// Parses version 1.0 xml script files.
	/// </summary>
	public class Parser10 : Parser
	{
		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_xelScript">The xmlscript file.</param>
		/// <param name="p_xstXmlScriptType">The <see cref="XmlScriptType"/> that describes
		/// XML script type metadata.</param>
		public Parser10(XElement p_xelScript, XmlScriptType p_xstXmlScriptType)
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
			IEnumerable<XElement> xeeDependencies = Script.XPathSelectElements("moduleDependancies/*");
			foreach (XElement xelCondition in xeeDependencies)
				cpcCondition.Conditions.Add(LoadCondition(xelCondition));
			return cpcCondition;
		}

		/// <summary>
		/// Parses <see cref="XmlScript.InstallSteps"/>.
		/// </summary>
		/// <returns>The <see cref="Script"/>'s <see cref="XmlScript.InstallSteps"/>, based on the XML,
		/// or <c>null</c> if the script doesn't describe any <see cref="XmlScript.InstallSteps"/>.</returns>
		protected override List<InstallStep> GetInstallSteps()
		{
			InstallStep stpStep = new InstallStep(null, null, SortOrder.Explicit);
			XElement xelGroups = Script.Element("optionalFileGroups");
			if (xelGroups != null)
				foreach (XElement xelGroup in xelGroups.Elements())
					stpStep.OptionGroups.Add(ParseGroup(xelGroup));

			List<InstallStep> lstStep = new List<InstallStep>();
			lstStep.Add(stpStep);
			return lstStep;
		}

		/// <summary>
		/// Parses the order of the <see cref="XmlScript.InstallSteps"/>.
		/// </summary>
		/// <returns>The order of the <see cref="Script"/>'s <see cref="XmlScript.InstallSteps"/>.</returns>
		protected override SortOrder GetInstallStepSortOrder()
		{
			return SortOrder.Explicit;
		}

		/// <summary>
		/// Parses <see cref="XmlScript.RequiredInstallFiles"/>.
		/// </summary>
		/// <returns>A <see cref="Script"/>'s <see cref="XmlScript.RequiredInstallFiles"/>, based on the XML,
		/// or <c>null</c> if the script doesn't describe any <see cref="XmlScript.RequiredInstallFiles"/>.</returns>
		protected override List<InstallableFile> GetRequiredInstallFiles()
		{
			IEnumerable<XElement> xeeRequiredInstallFiles = Script.XPathSelectElements("requiredInstallFiles/*");
			return ReadFileInfo(xeeRequiredInstallFiles);
		}

		/// <summary>
		/// Parses <see cref="XmlScript.ConditionallyInstalledFileSets"/>.
		/// </summary>
		/// <returns>A <see cref="Script"/>'s <see cref="XmlScript.ConditionallyInstalledFileSets"/>, based on the XML,
		/// or <c>null</c> if the script doesn't describe any <see cref="XmlScript.ConditionallyInstalledFileSets"/>.</returns>
		protected override List<ConditionallyInstalledFileSet> GetConditionallyInstalledFileSets()
		{
			return new List<ConditionallyInstalledFileSet>();
		}

		/// <summary>
		/// Parses <see cref="XmlScript.HeaderInfo"/>.
		/// </summary>
		/// <returns>A <see cref="XmlScript.HeaderInfo"/> based on the XML.</returns>
		protected override HeaderInfo GetHeaderInfo()
		{
			return new HeaderInfo(Script.Element("moduleName").Value, Color.FromKnownColor(KnownColor.ControlText), TextPosition.Left, null, true, true, -1);
		}

		#endregion

		#region Parsing Methods

		/// <summary>
		/// Creates a option group based on the given info.
		/// </summary>
		/// <param name="p_xelGroup">The script file node corresponding to the group to add.</param>
		/// <returns>The added group.</returns>
		protected virtual OptionGroup ParseGroup(XElement p_xelGroup)
		{
			string strName = p_xelGroup.Attribute("name").Value;
			OptionGroupType gtpType = (OptionGroupType)Enum.Parse(typeof(OptionGroupType), p_xelGroup.Attribute("type").Value);

			XElement xelOptions = p_xelGroup.Element("plugins");

			OptionGroup pgpGroup = new OptionGroup(strName, gtpType, SortOrder.Ascending);
			foreach (XElement xelOption in xelOptions.Elements())
				pgpGroup.Options.Add(ParseOption(xelOption));
			return pgpGroup;
		}

		/// <summary>
		/// Reads a option's information from the script file.
		/// </summary>
		/// <param name="p_xelOption">The script file node corresponding to the option to read.</param>
		/// <returns>The option information.</returns>
		protected virtual Option ParseOption(XElement p_xelOption)
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
				case "dependancyType":
					OptionType ptpDefaultType = (OptionType)Enum.Parse(typeof(OptionType), xelTypeDescriptor.Element("defaultType").Attribute("name").Value);
					iptType = new ConditionalOptionTypeResolver(ptpDefaultType);
					ConditionalOptionTypeResolver cotConditionalType = (ConditionalOptionTypeResolver)iptType;

					IEnumerable<XElement> xeePatterns = xelTypeDescriptor.XPathSelectElements("patterns/*");
					foreach (XElement xelPattern in xeePatterns)
					{
						OptionType ptpType = (OptionType)Enum.Parse(typeof(OptionType), xelPattern.Element("type").Attribute("name").Value);
						ICondition cpcCondition = LoadCondition(xelPattern.Element("dependancies"));
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
			return optOption;
		}

		/// <summary>
		/// Reads the condition from the given node.
		/// </summary>
		/// <param name="p_xelCondition">The node from which to load the condition.</param>
		/// <returns>An <see cref="ICondition"/> representing the condition described in the given node.</returns>
		protected virtual ICondition LoadCondition(XElement p_xelCondition)
		{
			if (p_xelCondition == null)
				return null;
			switch (p_xelCondition.GetSchemaInfo().SchemaType.Name)
			{
				case "compositeDependancy":
					ConditionOperator copOperator = (ConditionOperator)Enum.Parse(typeof(ConditionOperator), p_xelCondition.Attribute("operator").Value);
					CompositeCondition cpdCondition = new CompositeCondition(copOperator);
					foreach (XElement xelCondition in p_xelCondition.Elements())
						cpdCondition.Conditions.Add(LoadCondition(xelCondition));
					return cpdCondition;
				case "dependancy":
					string strCondition = p_xelCondition.Attribute("file").Value.ToLower();
					PluginState plsModState = (PluginState)Enum.Parse(typeof(PluginState), p_xelCondition.Attribute("state").Value);
					return new PluginCondition(strCondition, plsModState);
				case "moduleFileDependancy":
					string strFileCondition = p_xelCondition.Attribute("file").Value.ToLower();
					return new PluginCondition(strFileCondition, PluginState.Active);
				case "moduleVersionDependancy":
					switch (p_xelCondition.Name.LocalName)
					{
						case "falloutDependancy":
							Version verMinFalloutVersion = ParseVersion(p_xelCondition.Attribute("version").Value);
							return new GameVersionCondition(verMinFalloutVersion);
						case "fommDependancy":
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
		/// Reads the file info from the given XML nodes.
		/// </summary>
		/// <param name="p_xeeFiles">The list of XML nodes containing the file info to read.</param>
		/// <returns>An ordered list of <see cref="OptionFile"/>s representing the data in the given list.</returns>
		protected List<InstallableFile> ReadFileInfo(IEnumerable<XElement> p_xeeFiles)
		{
			List<InstallableFile> lstFiles = new List<InstallableFile>();
			foreach (XElement xelFile in p_xeeFiles)
			{
				string strSource = xelFile.Attribute("source").Value;
				string strDest = (xelFile.Attribute("destination") == null) ? strSource : xelFile.Attribute("destination").Value;
				bool booAlwaysInstall = Boolean.Parse(xelFile.Attribute("alwaysInstall").Value);
				bool booInstallIfUsable = Boolean.Parse(xelFile.Attribute("installIfUsable").Value);

				decimal dcmPriority = Decimal.Parse(xelFile.Attribute("priority").Value);
				if (dcmPriority > Int32.MaxValue)
					dcmPriority = Int32.MaxValue;
				else if (dcmPriority < Int32.MinValue)
					dcmPriority = Int32.MinValue;
				Int32 intPriority = (Int32)dcmPriority;

				switch (xelFile.Name.LocalName)
				{
					case "file":
						lstFiles.Add(new InstallableFile(strSource, strDest, false, intPriority, booAlwaysInstall, booInstallIfUsable));
						break;
					case "folder":
						lstFiles.Add(new InstallableFile(strSource, strDest, true, intPriority, booAlwaysInstall, booInstallIfUsable));
						break;
					default:
						throw new ParserException("Invalid file node: " + xelFile.Name + ". At this point the config file has been validated against the schema, so there's something wrong with the parser.");
				}
			}
			lstFiles.Sort();
			return lstFiles;
		}

		#endregion
	}
}
