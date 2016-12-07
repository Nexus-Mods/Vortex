using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.Xml.Linq;
using System.Xml.Schema;
using System.Xml.XPath;

namespace Nexus.Client.ModManagement.Scripting.XmlScript.Parsers
{
	/// <summary>
	/// Parses version 3.0 xml script files.
	/// </summary>
	public class Parser30 : Parser20
	{
		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_xelScript">The xmlscript file.</param>
		/// <param name="p_xstXmlScriptType">The <see cref="XmlScriptType"/> that describes
		/// XML script type metadata.</param>
		public Parser30(XElement p_xelScript, XmlScriptType p_xstXmlScriptType)
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
			XElement xelModDependencies = Script.Element("moduleDependencies");
			if (xelModDependencies == null)
				return null;
			return LoadCondition(xelModDependencies);
		}

		/// <summary>
		/// Parses <see cref="XmlScript.InstallSteps"/>.
		/// </summary>
		/// <returns>The <see cref="Script"/>'s <see cref="XmlScript.InstallSteps"/>, based on the XML,
		/// or <c>null</c> if the script doesn't describe any <see cref="XmlScript.InstallSteps"/>.</returns>
		protected override List<InstallStep> GetInstallSteps()
		{
			XElement xelGroups = Script.Element("optionalFileGroups");
			SortOrder sodGroupOrder = ParseSortOrder(xelGroups.Attribute("order").Value);
			InstallStep stpStep = new InstallStep(null, null, sodGroupOrder);
			if (xelGroups != null)
				foreach (XElement xelGroup in xelGroups.Elements())
					stpStep.OptionGroups.Add(ParseGroup(xelGroup));

			List<InstallStep> lstStep = new List<InstallStep>();
			lstStep.Add(stpStep);
			return lstStep;
		}

		/// <summary>
		/// Parses <see cref="XmlScript.HeaderInfo"/>.
		/// </summary>
		/// <returns>A <see cref="XmlScript.HeaderInfo"/> based on the XML.</returns>
		protected override HeaderInfo GetHeaderInfo()
		{
			XElement xelTitle = Script.Element("moduleName");
			string strTitle = xelTitle.Value;
			Color clrColour = Color.FromArgb((Int32)(UInt32.Parse(xelTitle.Attribute("colour").Value, NumberStyles.HexNumber, null) | 0xff000000));
			TextPosition tpsPosition = (TextPosition)Enum.Parse(typeof(TextPosition), xelTitle.Attribute("position").Value);

			XElement xelImage = Script.Element("moduleImage");
			if (xelImage != null)
			{
				XAttribute xatPath = xelImage.Attribute("path");
				string strImagePath = (xatPath == null) ? null : xatPath.Value;
				bool booShowImage = Boolean.Parse(xelImage.Attribute("showImage").Value);
				bool booShowFade = Boolean.Parse(xelImage.Attribute("showFade").Value);
				Int32 intHeight = Int32.Parse(xelImage.Attribute("height").Value);
				return new HeaderInfo(strTitle, clrColour, tpsPosition, strImagePath, booShowImage, booShowFade, intHeight);
			}
			return new HeaderInfo(strTitle, clrColour, tpsPosition, null, true, true, -1);
		}

		#endregion

		#region Parsing Methods

		/// <summary>
		/// Creates a option group based on the given info.
		/// </summary>
		/// <param name="p_xelGroup">The script file node corresponding to the group to add.</param>
		/// <returns>The added group.</returns>
		protected override OptionGroup ParseGroup(XElement p_xelGroup)
		{
			string strName = p_xelGroup.Attribute("name").Value;
			OptionGroupType gtpType = (OptionGroupType)Enum.Parse(typeof(OptionGroupType), p_xelGroup.Attribute("type").Value);

			XElement xelOptions = p_xelGroup.Element("plugins");
			SortOrder sodOptionOrder = ParseSortOrder(xelOptions.Attribute("order").Value);

			OptionGroup pgpGroup = new OptionGroup(strName, gtpType, sodOptionOrder);
			foreach (XElement xelOption in xelOptions.Elements())
				pgpGroup.Options.Add(ParseOption(xelOption));
			return pgpGroup;
		}


		/// <summary>
		/// Reads the condition from the given node.
		/// </summary>
		/// <param name="p_xelCondition">The node from which to load the condition.</param>
		/// <returns>An <see cref="ICondition"/> representing the condition described in the given node.</returns>
		protected override ICondition LoadCondition(XElement p_xelCondition)
		{
			if (p_xelCondition == null)
				return null;
			switch (p_xelCondition.GetSchemaInfo().SchemaType.Name)
			{
				case "compositeDependency":
					ConditionOperator copOperator = (ConditionOperator)Enum.Parse(typeof(ConditionOperator), p_xelCondition.Attribute("operator").Value);
					CompositeCondition cpdCondition = new CompositeCondition(copOperator);
					IEnumerable<XElement> xeeConditions = p_xelCondition.Elements();
					foreach (XElement xelCondition in xeeConditions)
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
				case "versionDependency":
					switch (p_xelCondition.Name.LocalName)
					{
						case "falloutDependency":
							Version verMinFalloutVersion = ParseVersion(p_xelCondition.Attribute("version").Value);
							return new GameVersionCondition(verMinFalloutVersion);
						case "fommDependency":
							Version verMinFommVersion = ParseVersion(p_xelCondition.Attribute("version").Value);
							return new ModManagerCondition(verMinFommVersion);
						default:
							throw new ParserException("Invalid plugin condition node: " + p_xelCondition.Name + ". At this point the config file has been validated against the schema, so there's something wrong with the parser.");
					}
				default:
					throw new ParserException("Invalid plugin condition node: " + p_xelCondition.Name + ". At this point the config file has been validated against the schema, so there's something wrong with the parser.");
			}
		}

		#endregion
	}
}
