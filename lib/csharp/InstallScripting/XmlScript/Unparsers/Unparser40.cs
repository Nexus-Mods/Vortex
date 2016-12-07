using System.Xml.Linq;

namespace Nexus.Client.ModManagement.Scripting.XmlScript.Unparsers
{
	/// <summary>
	/// Unparses version 4.0 XML scripts.
	/// </summary>
	public class Unparser40 : Unparser30
	{
		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_xscScript">The script to unparse.</param>
		/// <param name="p_xmlDocument">The <see cref="XmlDocument"/> to use to create the XML elements
		/// created during the unparsing.</param>
		public Unparser40(XmlScript p_xscScript)
			: base(p_xscScript)
		{
		}

		#endregion

		#region Abstract Method Implementations

		/// <summary>
		/// Unparses <see cref="XmlScript.InstallSteps"/>.
		/// </summary>
		/// <returns>An XML representation of the <see cref="Script"/>'s <see cref="XmlScript.InstallSteps"/>,
		/// or <c>null</c> if the script doean't have any <see cref="XmlScript.InstallSteps"/>.</returns>
		protected override XElement UnparseInstallSteps()
		{
			XElement xelSteps = null;
			if (Script.InstallSteps.Count > 0)
			{
				xelSteps = new XElement("installSteps",
								new XAttribute("order", UnparseSortOrder(Script.InstallStepSortOrder)));
				foreach (InstallStep ispStep in Script.InstallSteps)
					xelSteps.Add(UnparseInstallStep(ispStep));
			}
			return xelSteps;
		}

		#endregion

		#region Unparsing Methods

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
			XElement xelStep = new XElement("installStep",
									new XAttribute("name", p_ispStep.Name));
			if (p_ispStep.VisibilityCondition != null)
				xelStep.Add(UnparseCondition(p_ispStep.VisibilityCondition, "visible"));
			xelStep.Add(base.UnparseInstallStep(p_ispStep));
			return xelStep;
		}

		#endregion
	}
}
