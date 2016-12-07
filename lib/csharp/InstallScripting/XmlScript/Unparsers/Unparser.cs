using System;
using System.Collections.Generic;
using System.Xml.Linq;

namespace Nexus.Client.ModManagement.Scripting.XmlScript.Unparsers
{
	/// <summary>
	/// The base class for unparsers that create an XML representation of an <see cref="XmlScript"/>.
	/// </summary>
	public abstract class Unparser : IUnparser
	{
		#region Properties

		/// <summary>
		/// Gets the xml script.
		/// </summary>
		/// <value>The xml script.</value>
		protected XmlScript Script { get; private set; }

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_xscScript">The script to unparse.</param>
		public Unparser(XmlScript p_xscScript)
		{
			Script = p_xscScript;
		}

		#endregion

		/// <summary>
		/// Unparses the <see cref="Script"/> into an XML document.
		/// </summary>
		/// <returns>The XML representation of the <see cref="Script"/>.</returns>
		public XElement Unparse()
		{
			XElement xelScript = new XElement("config",
												new XAttribute(XName.Get("noNamespaceSchemaLocation", "http://www.w3.org/2001/XMLSchema-instance"), String.Format("XmlScript{0}.xsd", Script.Version)));
			
			List<XElement> lstHeaderInfo = UnparseHeaderInfo();
			foreach (XElement xelHeaderInfo in lstHeaderInfo)
				xelScript.Add(xelHeaderInfo);

			XElement xelPrerequisites = UnparseModPrerequisites();
			if (xelPrerequisites != null)
				xelScript.Add(xelPrerequisites);

			XElement xelRequiredInstallFiles = UnparseRequiredInstallFiles();
			if (xelRequiredInstallFiles != null)
				xelScript.Add(xelRequiredInstallFiles);

			XElement xelInstallSteps = UnparseInstallSteps();
			if (xelInstallSteps != null)
				xelScript.Add(xelInstallSteps);

			XElement xelConditionallyInstalledFileSets = UnparseConditionallyInstalledFileSets();
			if (xelConditionallyInstalledFileSets != null)
				xelScript.Add(xelConditionallyInstalledFileSets);

			return xelScript;
		}

		#region Main Unparse Methods

		/// <summary>
		/// Unparses <see cref="XmlScript.HeaderInfo"/>.
		/// </summary>
		/// <returns>An XML representation of the <see cref="Script"/>'s <see cref="XmlScript.HeaderInfo"/>.</returns>
		protected abstract List<XElement> UnparseHeaderInfo();

		/// <summary>
		/// Unparses <see cref="XmlScript.ModPrerequisites"/>.
		/// </summary>
		/// <returns>An XML representation of the <see cref="Script"/>'s <see cref="XmlScript.ModPrerequisites"/>,
		/// or <c>null</c> if the script doesn't have any <see cref="XmlScript.ModPrerequisites"/>.</returns>
		protected abstract XElement UnparseModPrerequisites();

		/// <summary>
		/// Unparses <see cref="XmlScript.RequiredInstallFiles"/>.
		/// </summary>
		/// <returns>An XML representation of the <see cref="Script"/>'s <see cref="XmlScript.RequiredInstallFiles"/>,
		/// or <c>null</c> if the script doesn't have any <see cref="XmlScript.RequiredInstallFiles"/>.</returns>
		protected abstract XElement UnparseRequiredInstallFiles();

		/// <summary>
		/// Unparses <see cref="XmlScript.InstallSteps"/>.
		/// </summary>
		/// <returns>An XML representation of the <see cref="Script"/>'s <see cref="XmlScript.InstallSteps"/>,
		/// or <c>null</c> if the script doesn't have any <see cref="XmlScript.InstallSteps"/>.</returns>
		protected abstract XElement UnparseInstallSteps();

		/// <summary>
		/// Unparses <see cref="XmlScript.ConditionallyInstalledFileSets"/>.
		/// </summary>
		/// <returns>An XML representation of the <see cref="Script"/>'s <see cref="XmlScript.ConditionallyInstalledFileSets"/>,
		/// or <c>null</c> if the script doesn't have any <see cref="XmlScript.ConditionallyInstalledFileSets"/>.</returns>
		protected abstract XElement UnparseConditionallyInstalledFileSets();

		#endregion

		#region Enumeration Unparsing Methods

		/// <summary>
		/// Translates the given <see cref="PluginState"/> into the string representation
		/// used in the XML.
		/// </summary>
		/// <param name="p_pstState">The <see cref="PluginState"/> to unparse.</param>
		/// <returns>The string representation used in the XML for the given <see cref="PluginState"/>.</returns>
		protected string UnparsePluginState(PluginState p_pstState)
		{
			return p_pstState.ToString();
		}

		/// <summary>
		/// Translates the given <see cref="OptionGroupType"/> into the string representation
		/// used in the XML.
		/// </summary>
		/// <param name="p_gtpType">The <see cref="OptionGroupType"/> to unparse.</param>
		/// <returns>The string representation used in the XML for the given <see cref="OptionGroupType"/>.</returns>
		protected string UnparseOptionGroupType(OptionGroupType p_gtpType)
		{
			return p_gtpType.ToString();
		}

		/// <summary>
		/// Translates the given <see cref="OptionType"/> into the string representation
		/// used in the XML.
		/// </summary>
		/// <param name="p_otpType">The <see cref="OptionType"/> to unparse.</param>
		/// <returns>The string representation used in the XML for the given <see cref="OptionType"/>.</returns>
		protected string UnparseOptionType(OptionType p_otpType)
		{
			return p_otpType.ToString();
		}

		/// <summary>
		/// Translates the given <see cref="ConditionOperator"/> into the string representation
		/// used in the XML.
		/// </summary>
		/// <param name="p_copOperator">The <see cref="ConditionOperator"/> to unparse.</param>
		/// <returns>The string representation used in the XML for the given <see cref="ConditionOperator"/>.</returns>
		protected string UnparseConditionOperator(ConditionOperator p_copOperator)
		{
			return p_copOperator.ToString();
		}

		/// <summary>
		/// Translates the given <see cref="bool"/> into the string representation
		/// used in the XML.
		/// </summary>
		/// <param name="p_copOpep_booValuerator">The <see cref="bool"/> to unparse.</param>
		/// <returns>The string representation used in the XML for the given <see cref="bool"/>.</returns>
		protected string UnparseBoolean(bool p_booValue)
		{
			return p_booValue.ToString().ToLowerInvariant();
		}

		#endregion
	}
}
