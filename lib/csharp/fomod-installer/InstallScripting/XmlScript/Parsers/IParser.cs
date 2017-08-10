using System;
using System.Collections.Generic;

namespace FomodInstaller.Scripting.XmlScript.Parsers
{
	/// <summary>
	/// Provides a contract for XML script file parsers.
	/// </summary>
	public interface IParser
	{
		XmlScript Parse();
	}
}
