using System;
using System.Collections.Generic;
using System.Xml.Linq;

namespace Nexus.Client.ModManagement.Scripting.XmlScript.Unparsers
{
	/// <summary>
	/// Unparses version 3.0 XML scripts.
	/// </summary>
	public class Unparser30 : Unparser20
	{
		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_xscScript">The script to unparse.</param>
		public Unparser30(XmlScript p_xscScript)
			: base(p_xscScript)
		{
		}

		#endregion

		#region Abstract Method Implementations

		/// <summary>
		/// Unparses <see cref="XmlScript.HeaderInfo"/>.
		/// </summary>
		/// <returns>An XML representation of the <see cref="Script"/>'s <see cref="XmlScript.HeaderInfo"/>.</returns>
		protected override List<XElement> UnparseHeaderInfo()
		{
			XElement xelHeaderTitle = new XElement("moduleName",
											new XAttribute("position", UnparseTextPosition(Script.HeaderInfo.TextPosition)),
											new XAttribute("colour", (Script.HeaderInfo.TextColour.ToArgb() & 0x00ffffff).ToString("x6")));
			xelHeaderTitle.Value = Script.HeaderInfo.Title;

			XElement xelHeaderImage = new XElement("moduleImage",
											new XAttribute("showImage", UnparseBoolean(Script.HeaderInfo.ShowImage)),
											new XAttribute("showFade", UnparseBoolean(Script.HeaderInfo.ShowFade)),
											new XAttribute("height", Script.HeaderInfo.Height.ToString()));
			if (!String.IsNullOrEmpty(Script.HeaderInfo.ImagePath))
				xelHeaderImage.Add(new XAttribute("path", Script.HeaderInfo.ImagePath));

			return new List<XElement>() { xelHeaderTitle, xelHeaderImage };
		}

		/// <summary>
		/// Unparses <see cref="XmlScript.ModPrerequisites"/>.
		/// </summary>
		/// <returns>An XML representation of the <see cref="Script"/>'s <see cref="XmlScript.ModPrerequisites"/>,
		/// or <c>null</c> if the script doean't have any <see cref="XmlScript.ModPrerequisites"/>.</returns>
		protected override XElement UnparseModPrerequisites()
		{
			if (Script.ModPrerequisites == null)
				return null;
			return UnparseCondition(Script.ModPrerequisites, "moduleDependencies");
		}

		#endregion

		#region Unparsing Methods

		/// <summary>
		/// Unparses the given <see cref="ICondition"/>.
		/// </summary>
		/// <remarks>
		/// This method can be overidden to provide game-specific or newer-version unparsing.
		/// </remarks>
		/// <param name="p_cndCondition">The <see cref="ICondition"/> for which to generate XML.</param>
		/// <returns>The XML representation of the given <see cref="ICondition"/>.</returns>
		protected override XElement UnparsePrerequisiteCondition(ICondition p_cndCondition)
		{
			throw new InvalidOperationException("This method is only for versions of the Xml Script prior to 3.0.");
		}

		/// <summary>
		/// Unparses the given <see cref="InstallStep"/>.
		/// </summary>
		/// <remarks>
		/// This method can be overidden to provide game-specific or newer-version unparsing.
		/// </remarks>
		/// <param name="p_ispStep">The <see cref="InstallStep"/> for which to generate XML.</param>
		/// <returns>The XML representation of the given <see cref="InstallStep"/>.</returns>
		protected override XElement UnparseInstallStep(InstallStep p_ispStep)
		{
			XElement xelStep = base.UnparseInstallStep(p_ispStep);
			if (xelStep != null)
				xelStep.Add(new XAttribute("order", UnparseSortOrder(p_ispStep.GroupSortOrder)));
			return xelStep;
		}

		/// <summary>
		/// Unparses the given <see cref="OptionGroup"/>.
		/// </summary>
		/// <remarks>
		/// This method can be overidden to provide game-specific or newer-version unparsing.
		/// </remarks>
		/// <param name="p_ogpGroup">The <see cref="OptionGroup"/> for which to generate XML.</param>
		/// <returns>The XML representation of the given <see cref="OptionGroup"/>.</returns>
		protected override XElement UnparseOptionGroup(OptionGroup p_ogpGroup)
		{
			XElement xelGroup = base.UnparseOptionGroup(p_ogpGroup);
			XElement xelOptions = xelGroup.Element("plugins");
			xelOptions.Add(new XAttribute("order", UnparseSortOrder(p_ogpGroup.OptionSortOrder)));
			return xelGroup;
		}

		#endregion

		#region Enumeration Unparsing Methods

		/// <summary>
		/// Translates the given <see cref="TextPosition"/> into the string representation
		/// used in the XML.
		/// </summary>
		/// <param name="p_tpsPosition">The <see cref="TextPosition"/> to unparse.</param>
		/// <returns>The string representation used in the XML for the given <see cref="TextPosition"/>.</returns>
		protected string UnparseTextPosition(TextPosition p_tpsPosition)
		{
			return p_tpsPosition.ToString();
		}

		/// <summary>
		/// Translates the given <see cref="SortOrder"/> into the string representation
		/// used in the XML.
		/// </summary>
		/// <param name="p_sorOrder">The <see cref="SortOrder"/> to unparse.</param>
		/// <returns>The string representation used in the XML for the given <see cref="SortOrder"/>.</returns>
		protected string UnparseSortOrder(SortOrder p_sorOrder)
		{
			return p_sorOrder.ToString();
		}

		#endregion
	}
}
