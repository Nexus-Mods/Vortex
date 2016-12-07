using System.Xml.Linq;

namespace Nexus.Client.ModManagement.Scripting.XmlScript.Unparsers
{
	/// <summary>
	/// Unparses version 5.0 XML scripts.
	/// </summary>
	public class Unparser50 : Unparser40
	{
		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_xscScript">The script to unparse.</param>
		public Unparser50(XmlScript p_xscScript)
			: base(p_xscScript)
		{
		}

		#endregion

		#region Unparsing Methods

		/// <summary>
		/// Unparses the given <see cref="ICondition"/>, giving the generated mod the specified name.
		/// </summary>
		/// <remarks>
		/// This method can be overidden to provide game-specific or newer-version unparsing.
		/// </remarks>
		/// <param name="p_cndCondition">The <see cref="ICondition"/> for which to generate XML.</param>
		/// <param name="p_strNodeName">The name to give to the generated node.</param>
		/// <returns>The XML representation of the given <see cref="ICondition"/>.</returns>
		protected override XElement UnparseCondition(ICondition p_cndCondition, string p_strNodeName)
		{
			if (p_cndCondition is GameVersionCondition)
			{
				XElement xelGameVersion = new XElement("gameDependency",
												new XAttribute("version", ((GameVersionCondition)p_cndCondition).MinimumVersion.ToString()));
				return xelGameVersion;
			}
			return base.UnparseCondition(p_cndCondition, p_strNodeName);
		}

		#endregion
	}
}
