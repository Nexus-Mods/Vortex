using System.Xml.Linq;

namespace Nexus.Client.ModManagement.Scripting.XmlScript.Unparsers
{
	/// <summary>
	/// Provides a contract for XML script unparsers.
	/// </summary>
	public interface IUnparser
	{
		/// <summary>
		/// Unparses the <see cref="Script"/> into an XML document.
		/// </summary>
		/// <returns>The XML representation of the <see cref="Script"/>.</returns>
		XElement Unparse();
	}
}
