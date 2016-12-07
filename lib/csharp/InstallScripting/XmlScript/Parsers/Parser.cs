using System;
using System.Collections.Generic;
using System.Xml.Linq;
using System.Xml.Schema;

namespace Nexus.Client.ModManagement.Scripting.XmlScript.Parsers
{
	/// <summary>
	/// Provides a contract and base functionality for XML configuration file parsers.
	/// </summary>
	public abstract class Parser : IParser
	{
		#region Properties

		/// <summary>
		/// Gets the xml script file.
		/// </summary>
		/// <value>The xml script file.</value>
		protected XElement Script { get; private set; }

		/// <summary>
		/// Gets the <see cref="XmlScriptType"/> that describes
		/// XML script type metadata.
		/// </summary>
		/// <value>The <see cref="XmlScriptType"/> that describes
		/// XML script type metadata.</value>
		protected XmlScriptType ScriptType { get; private set; }

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_xelScript">The xml script file.</param>
		/// <param name="p_xstXmlScriptType">The <see cref="XmlScriptType"/> that describes
		/// XML script type metadata.</param>
		public Parser(XElement p_xelScript, XmlScriptType p_xstXmlScriptType)
		{
			Script = p_xelScript;
			ScriptType = p_xstXmlScriptType;
			if ((p_xelScript.GetSchemaInfo() == null) || (p_xelScript.GetSchemaInfo().Validity != XmlSchemaValidity.Valid))
				p_xstXmlScriptType.ValidateXmlScript(p_xelScript);
		}

		#endregion

		#region Main Parse Methods

		/// <summary>
		/// Parses <see cref="XmlScript.HeaderInfo"/>.
		/// </summary>
		/// <returns>A <see cref="XmlScript.HeaderInfo"/> based on the XML.</returns>
		protected abstract HeaderInfo GetHeaderInfo();

		/// <summary>
		/// Parses <see cref="XmlScript.ModPrerequisites"/>.
		/// </summary>
		/// <returns>The script's <see cref="XmlScript.ModPrerequisites"/>, based on the XML,
		/// or <c>null</c> if the XML doesn't describe any <see cref="XmlScript.ModPrerequisites"/>.</returns>
		protected abstract ICondition GetModPrerequisites();

		/// <summary>
		/// Parses <see cref="XmlScript.InstallSteps"/>.
		/// </summary>
		/// <returns>The <see cref="Script"/>'s <see cref="XmlScript.InstallSteps"/>, based on the XML,
		/// or <c>null</c> if the script doesn't describe any <see cref="XmlScript.InstallSteps"/>.</returns>
		protected abstract List<InstallStep> GetInstallSteps();

		/// <summary>
		/// Parses the order of the <see cref="XmlScript.InstallSteps"/>.
		/// </summary>
		/// <returns>The order of the <see cref="Script"/>'s <see cref="XmlScript.InstallSteps"/>.</returns>
		protected abstract SortOrder GetInstallStepSortOrder();

		/// <summary>
		/// Parses <see cref="XmlScript.RequiredInstallFiles"/>.
		/// </summary>
		/// <returns>A <see cref="Script"/>'s <see cref="XmlScript.RequiredInstallFiles"/>, based on the XML,
		/// or <c>null</c> if the script doesn't describe any <see cref="XmlScript.RequiredInstallFiles"/>.</returns>
		protected abstract List<InstallableFile> GetRequiredInstallFiles();

		/// <summary>
		/// Parses <see cref="XmlScript.ConditionallyInstalledFileSets"/>.
		/// </summary>
		/// <returns>A <see cref="Script"/>'s <see cref="XmlScript.ConditionallyInstalledFileSets"/>, based on the XML,
		/// or <c>null</c> if the script doesn't describe any <see cref="XmlScript.ConditionallyInstalledFileSets"/>.</returns>
		protected abstract List<ConditionallyInstalledFileSet> GetConditionallyInstalledFileSets();

		#endregion

		#region IParser Members

		/// <summary>
		/// Parses the <see cref="Script"/> from an XML document.
		/// </summary>
		/// <returns>The XML representation of the <see cref="Script"/>.</returns>
		public XmlScript Parse()
		{
			HeaderInfo hdrHeader = GetHeaderInfo();
			ICondition cndModPrerequisites = GetModPrerequisites();
			List<InstallableFile> lstRequiredInstallFiles = GetRequiredInstallFiles();
			List<InstallStep> lstInstallSteps = GetInstallSteps();
			List<ConditionallyInstalledFileSet> lstConditionallyInstalledFileSets = GetConditionallyInstalledFileSets();
			XmlScript xscScript = new XmlScript(ScriptType, ScriptType.GetXmlScriptVersion(Script), hdrHeader, cndModPrerequisites, lstRequiredInstallFiles, lstInstallSteps, GetInstallStepSortOrder(), lstConditionallyInstalledFileSets);
			return xscScript;
		}

		#endregion

		#region Enumeration Parsing Methods

		/// <summary>
		/// Parser the given string into a <see cref="SortOrder"/>
		/// </summary>
		/// <param name="p_strOrder">The string representation of the <see cref="SortOrder"/>.</param>
		/// <returns>The <see cref="SortOrder"/> represented by the given string.</returns>
		public static SortOrder ParseSortOrder(string p_strOrder)
		{
			if (String.IsNullOrEmpty(p_strOrder))
				return SortOrder.Explicit;
			switch (p_strOrder)
			{
				case "Ascending":
					return SortOrder.Ascending;
				case "Descending":
					return SortOrder.Descending;
			}
			return SortOrder.Explicit;
		}

		/// <summary>
		/// Parser the given string into a <see cref="Version"/>.
		/// </summary>
		/// <param name="p_strVersion">The string representation of the <see cref="Version"/>.</param>
		/// <returns>A <see cref="Version"/> whose value is represented by the given string. If the
		/// string does not represent a valid version, then a <see cref="Version"/> representing
		/// 0.0.0.0 is returned.</returns>
		public static Version ParseVersion(string p_strVersion)
		{
			Version verVersion = null;
			try
			{
				verVersion = new Version(p_strVersion);
			}
			catch
			{
				verVersion = new Version(0, 0, 0, 0);
			}
			return verVersion;
		}

		#endregion
	}
}
