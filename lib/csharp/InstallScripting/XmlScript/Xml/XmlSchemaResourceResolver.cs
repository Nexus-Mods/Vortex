using System;
using System.Linq;
using System.Xml;
using System.Reflection;
using System.IO;

namespace Nexus.Client.ModManagement.Scripting.XmlScript.Xml
{
	/// <summary>
	/// This resolves references to external files from within schemas.
	/// </summary>
	/// <remarks>
	/// This resolver handles schemas stored as an assembly resources.
	/// </remarks>
	public class XmlSchemaResourceResolver : XmlUrlResolver
	{
		/// <summary>
		/// Returns the requested entity.
		/// </summary>
		/// <remarks>
		/// This method retrieves the specified entity, even if it is stored as an assembly resource.
		/// </remarks>
		/// <param name="absoluteUri">The uri of the entity to retrieve.</param>
		/// <param name="role">Unused.</param>
		/// <param name="ofObjectToReturn">The type of object to return. This implementation only returns <see cref="Stream"/> objects.</param>
		/// <returns>The requested entity.</returns>
		public override object GetEntity(Uri absoluteUri, string role, Type ofObjectToReturn)
		{
			if (!absoluteUri.Scheme.Equals("assembly", StringComparison.OrdinalIgnoreCase))
				return base.GetEntity(absoluteUri, role, ofObjectToReturn);

			Assembly asmResourceAssembly = (from asm in AppDomain.CurrentDomain.GetAssemblies()
											where asm.GetName().Name.Equals(absoluteUri.Authority, StringComparison.OrdinalIgnoreCase)
											select asm).First();
			string strPath = absoluteUri.AbsolutePath.Trim(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar).Replace(Path.DirectorySeparatorChar,'.').Replace(Path.AltDirectorySeparatorChar,'.');
			if (Array.Exists(asmResourceAssembly.GetManifestResourceNames(), (s) => { return strPath.Equals(s, StringComparison.OrdinalIgnoreCase); }))
				return asmResourceAssembly.GetManifestResourceStream(strPath);
			string file = Path.GetFileName(absoluteUri.AbsolutePath);
			asmResourceAssembly = Assembly.GetAssembly(typeof(XmlSchemaResourceResolver));
			Stream stream = asmResourceAssembly.GetManifestResourceStream(String.Format("Nexus.Client.ModManagement.Scripting.XmlScript.Schemas.{0}", file));
			return stream;
		}
	}
}
