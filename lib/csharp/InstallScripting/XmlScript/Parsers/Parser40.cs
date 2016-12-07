using System.Collections.Generic;
using System.Xml.Linq;
using System.Xml.XPath;

namespace Nexus.Client.ModManagement.Scripting.XmlScript.Parsers
{
	/// <summary>
	/// Parses version 4.0 xml script files.
	/// </summary>
	public class Parser40 : Parser30
	{
		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_xelScript">The xmlscript file.</param>
		/// <param name="p_xstXmlScriptType">The <see cref="XmlScriptType"/> that describes
		/// XML script type metadata.</param>
		public Parser40(XElement p_xelScript, XmlScriptType p_xstXmlScriptType)
			: base(p_xelScript, p_xstXmlScriptType)
		{
		}

		#endregion

		#region Abstract Method Implementations

		/// <summary>
		/// Parses <see cref="XmlScript.InstallSteps"/>.
		/// </summary>
		/// <returns>The <see cref="Script"/>'s <see cref="XmlScript.InstallSteps"/>, based on the XML,
		/// or <c>null</c> if the script doesn't describe any <see cref="XmlScript.InstallSteps"/>.</returns>
		protected override List<InstallStep> GetInstallSteps()
		{
			XElement xelSteps = Script.Element("installSteps");
			List<InstallStep> lstStep = new List<InstallStep>();
			if (xelSteps != null)
				foreach (XElement xelStep in xelSteps.Elements())
					lstStep.Add(ParseInstallStep(xelStep));
			return lstStep;
		}

		/// <summary>
		/// Parses the order of the <see cref="XmlScript.InstallSteps"/>.
		/// </summary>
		/// <returns>The order of the <see cref="Script"/>'s <see cref="XmlScript.InstallSteps"/>.</returns>
		protected override SortOrder GetInstallStepSortOrder()
		{
			XElement xelSteps = Script.Element("installSteps");
			if (xelSteps != null)
				return ParseSortOrder(xelSteps.Attribute("order").Value);
			return SortOrder.Explicit;
		}

		#endregion

		#region Parsing Methods

		/// <summary>
		/// Creates an install step based on the given info.
		/// </summary>
		/// <param name="p_xelStep">The configuration file node corresponding to the install step to add.</param>
		/// <returns>The added install step.</returns>
		protected virtual InstallStep ParseInstallStep(XElement p_xelStep)
		{
			string strName = p_xelStep.Attribute("name").Value;
			ICondition cndVisibility = LoadCondition(p_xelStep.Element("visible"));

			XElement xelGroups = p_xelStep.Element("optionalFileGroups");
			SortOrder sodGroupOrder = ParseSortOrder(xelGroups.Attribute("order").Value);
			
			InstallStep stpStep = new InstallStep(strName, cndVisibility, sodGroupOrder);
			foreach (XElement xelGroup in xelGroups.Elements())
				stpStep.OptionGroups.Add(ParseGroup(xelGroup));
			return stpStep;
		}

		#endregion
	}
}
