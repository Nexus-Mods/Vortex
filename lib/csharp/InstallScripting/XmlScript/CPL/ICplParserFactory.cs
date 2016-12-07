using Nexus.Client.Util.Antlr;

namespace Nexus.Client.ModManagement.Scripting.XmlScript.CPL
{
	/// <summary>
	/// Describes the properties and methods of a factory that creates CPL parsers.
	/// </summary>
	public interface ICplParserFactory
	{
		/// <summary>
		/// Creates a CPL parser for the given code, using the given error tracker.
		/// </summary>
		/// <param name="p_strCode">The code be parsed.</param>
		/// <param name="p_ertErrorTracker">The error tracker to use to log
		/// parsing errors.</param>
		/// <returns>A CPL parser for the given code.</returns>
		AntlrParserBase CreateParser(string p_strCode, ErrorTracker p_ertErrorTracker);

		/// <summary>
		/// Creates a CPL lexer for the given code, using the given error tracker.
		/// </summary>
		/// <param name="p_strCode">The code be lexed.</param>
		/// <param name="p_ertErrorTracker">The error tracker to use to log
		/// lexing errors.</param>
		/// <returns>A CPL lexer for the given code.</returns>
		AntlrLexerBase CreateLexer(string p_strCode, ErrorTracker p_ertErrorTracker);
	}
}
