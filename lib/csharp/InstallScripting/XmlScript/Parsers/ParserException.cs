using System;

namespace Nexus.Client.ModManagement.Scripting.XmlScript.Parsers
{
	/// <summary>
	/// The exception that is thrown if there is a problem parsing a config file.
	/// </summary>
	public class ParserException : Exception
	{
		/// <summary>
		/// The default constructor.
		/// </summary>
		public ParserException()
		{
		}

		/// <summary>
		/// A simple contructor that sets the exception's message.
		/// </summary>
		/// <param name="message">The exception's message.</param>
		public ParserException(string message)
			: base(message)
		{
		}

		/// <summary>
		/// A simple constructor the sets the exception's message and inner exception.
		/// </summary>
		/// <param name="message">The exception's message.</param>
		/// <param name="inner">The ineer exception.</param>
		public ParserException(string message, Exception inner)
			: base(message, inner)
		{
		}
	}
}
