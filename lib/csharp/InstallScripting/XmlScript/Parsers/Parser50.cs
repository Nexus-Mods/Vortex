using System;
using System.Collections.Generic;
using System.Xml.Linq;
using System.Xml.Schema;

namespace Nexus.Client.ModManagement.Scripting.XmlScript.Parsers
{
	/// <summary>
	/// Parses version 5.0 xml script files.
	/// </summary>
	public class Parser50 : Parser40
	{
		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_xelScript">The xmlscript file.</param>
		/// <param name="p_xstXmlScriptType">The <see cref="XmlScriptType"/> that describes
		/// XML script type metadata.</param>
		public Parser50(XElement p_xelScript, XmlScriptType p_xstXmlScriptType)
			: base(p_xelScript, p_xstXmlScriptType)
		{
		}

		#endregion

		#region Parsing Methods

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
						case "gameDependency":
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
