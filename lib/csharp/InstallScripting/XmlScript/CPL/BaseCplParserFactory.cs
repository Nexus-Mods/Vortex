using Antlr.Runtime;
using Nexus.Client.Util.Antlr;

namespace Nexus.Client.ModManagement.Scripting.XmlScript.CPL
{
	/// <summary>
	/// Creates CPL parsers.
	/// </summary>
	public class BaseCplParserFactory : ICplParserFactory
	{
		#region ICplParserFactory Members

		/// <summary>
		/// Creates a CPL parser for the given code, using the given error tracker.
		/// </summary>
		/// <param name="p_strCode">The code be parsed.</param>
		/// <param name="p_ertErrorTracker">The error tracker to use to log
		/// parsing errors.</param>
		/// <returns>A CPL parser for the given code.</returns>
		public AntlrParserBase CreateParser(string p_strCode, ErrorTracker p_ertErrorTracker)
		{
			AntlrLexerBase lexLexer = CreateLexer(p_strCode, p_ertErrorTracker);
			CommonTokenStream ctsTokens = new CommonTokenStream(lexLexer);
			CPLParser prsParser = new CPLParser(ctsTokens);
			prsParser.ErrorTracker = p_ertErrorTracker;
			return prsParser;
		}

		/// <summary>
		/// Creates a CPL lexer for the given code, using the given error tracker.
		/// </summary>
		/// <param name="p_strCode">The code be lexed.</param>
		/// <param name="p_ertErrorTracker">The error tracker to use to log
		/// lexing errors.</param>
		/// <returns>A CPL lexer for the given code.</returns>
		public AntlrLexerBase CreateLexer(string p_strCode, ErrorTracker p_ertErrorTracker)
		{
			CPLLexer lexLexer = new CPLLexer(new ANTLRStringStream(p_strCode));
			lexLexer.ErrorTracker = p_ertErrorTracker;
			return lexLexer;
		}

		#endregion
	}
}
