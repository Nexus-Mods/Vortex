using System;
using System.Collections.Generic;

namespace Components.Scripting.XmlScript.Parsers
{
	/// <summary>
	/// Provides a contract for XML script file parsers.
	/// </summary>
	public interface IParser
	{
		XmlScript Parse();
	}
}
