using System;
using System.Collections.Generic;

namespace Nexus.Client.ModManagement.Scripting.XmlScript.Parsers
{
	/// <summary>
	/// Provides a contract for XML script file parsers.
	/// </summary>
	public interface IParser
	{
		XmlScript Parse();
	}
}
