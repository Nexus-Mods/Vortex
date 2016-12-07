using System;
using System.Text;
using Antlr.Runtime.Tree;
using Nexus.Client.Util.Antlr;

namespace Nexus.Client.ModManagement.Scripting.XmlScript.CPL
{
	public class CPLConverter
	{
		protected ICplParserFactory ParserFactory { get; set; }

		/// <summary>
		/// A simple constructor that initializes the <see cref="ICplParserFactory"/> to use.
		/// </summary>
		/// <param name="p_pftParserFactory">The <see cref="ICplParserFactory"/> to use to create the
		/// parser to use to build the AST.</param>
		public CPLConverter(ICplParserFactory p_pftParserFactory)
		{
			ParserFactory = p_pftParserFactory;
		}

		/// <summary>
		/// Parses the given CPL into an AST.
		/// </summary>
		/// <param name="p_strCplCode">The CPL to convert.</param>
		/// <returns>The AST built from the given CPL.</returns>
		private ITree GenerateAst(string p_strCplCode)
		{
			ErrorTracker ertErrors = new ErrorTracker();
			AntlrParserBase cpbParser = ParserFactory.CreateParser(p_strCplCode, ertErrors);
			ITree astCPL = cpbParser.Parse();
			if (ertErrors.HasErrors)
				throw new ArgumentException("Invalid CPL:" + Environment.NewLine + ertErrors.ToString(), "p_strCplCode");
			return astCPL;
		}

		/// <summary>
		/// Converts the given CPL into a <see cref="ICondition"/>.
		/// </summary>
		/// <param name="p_strCplCode">The CPL to convert.</param>
		/// <returns>A <see cref="ICondition"/> representing the given CPL.</returns>
		/// <exception cref="ArgumentException">Thrown if the given CPL is invalid.</exception>
		public ICondition CplToCondition(string p_strCplCode)
		{
			if (String.IsNullOrEmpty(p_strCplCode))
				return null;
			ITree astCPL = GenerateAst(p_strCplCode);
			return BuildCompositeCondition(astCPL);
		}

		protected virtual ICondition BuildCompositeCondition(ITree p_astCPL)
		{
			switch (p_astCPL.Type)
			{
				case CPLParser.AND:
					CompositeCondition cpcAndCondition = new CompositeCondition(ConditionOperator.And);
					for (Int32 i = 0; i < p_astCPL.ChildCount; i++)
						cpcAndCondition.Conditions.Add(BuildCompositeCondition(p_astCPL.GetChild(i)));
					return cpcAndCondition;
				case CPLParser.OR:
					CompositeCondition cpcOrCondition = new CompositeCondition(ConditionOperator.Or);
					for (Int32 i = 0; i < p_astCPL.ChildCount; i++)
						cpcOrCondition.Conditions.Add(BuildCompositeCondition(p_astCPL.GetChild(i)));
					return cpcOrCondition;
				case CPLParser.EQUALS:
					string strFlagName = p_astCPL.GetChild(0).Text.Trim('$');
					string strFlagValue = p_astCPL.GetChild(1).Text.Trim('"');
					FlagCondition flcCondition = new FlagCondition(strFlagName, strFlagValue);
					return flcCondition;
				case CPLParser.IS:
					string strPluginPath = p_astCPL.GetChild(0).Text.Trim('"');
					string strState = p_astCPL.GetChild(1).Text.ToUpperInvariant();
					strState = strState[0] + strState.Remove(0, 1).ToLowerInvariant();
					PluginState pnsState = (PluginState)Enum.Parse(typeof(PluginState), strState);
					PluginCondition pncCondition = new PluginCondition(strPluginPath, pnsState);
					return pncCondition;
				case CPLParser.ATLEAST:
					string strVersion = p_astCPL.GetChild(1).Text;
					if (!strVersion.Contains("."))
						strVersion += ".0";
					Version verVersion = new Version(strVersion);
					switch (p_astCPL.GetChild(0).Type)
					{
						case CPLParser.GAME_VERSION:
							return new GameVersionCondition(verVersion);
						case CPLParser.MANAGER_VERSION:
							return new ModManagerCondition(verVersion);
					}
					throw new Exception("Unknown: " + p_astCPL.Text);
				default:
					throw new Exception("Unknown: " + p_astCPL.Text);
			}
		}

		/// <summary>
		/// Converts the given <see cref="ICondition"/> into CPL.
		/// </summary>
		/// <param name="p_cndCondition">The condition to convert.</param>
		/// <returns>CPL representing the given condition.</returns>
		public string ConditionToCpl(ICondition p_cndCondition)
		{
			string strCPL = GenerateCpl(p_cndCondition);
			if ((p_cndCondition is CompositeCondition) && (((CompositeCondition)p_cndCondition).Operator == ConditionOperator.Or))
				strCPL = strCPL.Remove(strCPL.Length - 1, 1).Remove(0, 1);
			return strCPL;
		}

		protected virtual string GenerateCpl(ICondition p_cndCondition)
		{
			StringBuilder stbCPL = new StringBuilder();
			if (p_cndCondition is CompositeCondition)
			{
				CompositeCondition cpcCondition = (CompositeCondition)p_cndCondition;
				string strOperator = null;
				string strPrefix = null;
				string strSuffix = null;
				switch (cpcCondition.Operator)
				{
					case ConditionOperator.And:
						strOperator = "AND";
						break;
					case ConditionOperator.Or:
						strOperator = "OR";
						strPrefix = "(";
						strSuffix = ")";
						break;
				}
				stbCPL.Append(strPrefix);
				for (Int32 i = 0; i < cpcCondition.Conditions.Count; i++)
				{
					stbCPL.Append(GenerateCpl(cpcCondition.Conditions[i]));
					if (i < cpcCondition.Conditions.Count - 1)
						stbCPL.AppendFormat(" {0} ", strOperator);
				}
				stbCPL.Append(strSuffix);
			}
			else if (p_cndCondition is FlagCondition)
			{
				FlagCondition flcCondition = (FlagCondition)p_cndCondition;
				stbCPL.AppendFormat("${0}$ = \"{1}\"", flcCondition.FlagName, flcCondition.Value);
			}
			else if (p_cndCondition is PluginCondition)
			{
				PluginCondition pncCondition = (PluginCondition)p_cndCondition;
				stbCPL.AppendFormat("\"{0}\" is {1}", pncCondition.PluginPath, pncCondition.State.ToString());
			}
			else if (p_cndCondition is GameVersionCondition)
			{
				GameVersionCondition gvcCondition = (GameVersionCondition)p_cndCondition;
				stbCPL.AppendFormat("gameVersion >= {0}", gvcCondition.MinimumVersion.ToString());
			}
			else if (p_cndCondition is ModManagerCondition)
			{
				ModManagerCondition mmcCondition = (ModManagerCondition)p_cndCondition;
				stbCPL.AppendFormat("managerVersion >= {0}", mmcCondition.MinimumVersion.ToString());
			}
			return stbCPL.ToString();
		}
	}
}
