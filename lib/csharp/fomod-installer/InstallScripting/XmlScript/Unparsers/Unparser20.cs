using System;
using System.Xml.Linq;
using Utils.Collections;

namespace FomodInstaller.Scripting.XmlScript.Unparsers
{
	/// <summary>
	/// Unparses version 2.0 XML scripts.
	/// </summary>
	public class Unparser20 : Unparser10
	{
		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_xscScript">The script to unparse.</param>
		public Unparser20(XmlScript p_xscScript)
			: base(p_xscScript)
		{
		}

		#endregion

		#region Abstract Method Implementations

		/// <summary>
		/// Unparses <see cref="XmlScript.ModPrerequisites"/>.
		/// </summary>
		/// <returns>An XML representation of the <see cref="Script"/>'s <see cref="XmlScript.ModPrerequisites"/>,
		/// or <c>null</c> if the script doean't have any <see cref="XmlScript.ModPrerequisites"/>.</returns>
		protected override XElement UnparseModPrerequisites()
		{
			if (Script.ModPrerequisites == null)
				return null;

			XElement xelPrerequisites = new XElement("moduleDependencies");
			if (Script.ModPrerequisites is CompositeCondition)
			{
				foreach (ICondition cndCondition in ((CompositeCondition)Script.ModPrerequisites).Conditions)
				{
					XElement xelCondition = UnparsePrerequisiteCondition(cndCondition);
					if (xelCondition != null)
						xelPrerequisites.Add(xelCondition);
				}
			}
			else
			{
				XElement xelCondition = UnparsePrerequisiteCondition(Script.ModPrerequisites);
				if (xelCondition != null)
					xelPrerequisites.Add(xelCondition);
			}
			return xelPrerequisites;
		}

		/// <summary>
		/// Unparses <see cref="XmlScript.ConditionallyInstalledFileSet"/>s.
		/// </summary>
		/// <returns>An XML representation of the <see cref="Script"/>'s <see cref="XmlScript.ConditionallyInstalledFileSets"/>,
		/// or <c>null</c> if the script doean't have any <see cref="XmlScript.ConditionallyInstalledFileSets"/>.</returns>
		protected override XElement UnparseConditionallyInstalledFileSets()
		{
			if (Script.ConditionallyInstalledFileSets.IsNullOrEmpty())
				return null;
			XElement xelFileSets = new XElement("conditionalFileInstalls");
			XElement xelPatterns = new XElement("patterns");
			xelFileSets.Add(xelPatterns);
			foreach (ConditionallyInstalledFileSet cifFileSet in Script.ConditionallyInstalledFileSets)
				xelPatterns.Add(UnparseConditionallyInstalledFileSet(cifFileSet));
			return xelFileSets;
		}

		#endregion

		#region Unparsing Methods

		/// <summary>
		/// Unparses the given <see cref="ICondition"/>.
		/// </summary>
		/// <remarks>
		/// This method can be overidden to provide game-specific or newer-version unparsing.
		/// </remarks>
		/// <param name="p_cndCondition">The <see cref="ICondition"/> for which to generate XML.</param>
		/// <returns>The XML representation of the given <see cref="ICondition"/>.</returns>
		protected override XElement UnparsePrerequisiteCondition(ICondition p_cndCondition)
		{
			if (p_cndCondition is PluginCondition)
			{
				XElement xelPlugin = new XElement("fileDependency",
													new XAttribute("file", ((PluginCondition)p_cndCondition).PluginPath));
				return xelPlugin;
			}
			return UnparseCondition(p_cndCondition);
		}

		/// <summary>
		/// Unparses the given <see cref="ICondition"/>.
		/// </summary>
		/// <remarks>
		/// This method can be overidden to provide game-specific or newer-version unparsing.
		/// </remarks>
		/// <param name="p_cndCondition">The <see cref="ICondition"/> for which to generate XML.</param>
		/// <returns>The XML representation of the given <see cref="ICondition"/>.</returns>
		protected override XElement UnparseCondition(ICondition p_cndCondition)
		{
			return UnparseCondition(p_cndCondition, "dependencies");
		}

		/// <summary>
		/// Unparses the given <see cref="ICondition"/>, giving the generated mod the specified name.
		/// </summary>
		/// <remarks>
		/// This method can be overidden to provide game-specific or newer-version unparsing.
		/// </remarks>
		/// <param name="p_cndCondition">The <see cref="ICondition"/> for which to generate XML.</param>
		/// <param name="p_strNodeName">The name to give to the generated node.</param>
		/// <returns>The XML representation of the given <see cref="ICondition"/>.</returns>
		protected virtual XElement UnparseCondition(ICondition p_cndCondition, string p_strNodeName)
		{
			if (p_cndCondition is CompositeCondition)
			{
				XElement xelCompositeCondition = new XElement(p_strNodeName,
																new XAttribute("operator", UnparseConditionOperator(((CompositeCondition)p_cndCondition).Operator)));
				foreach (ICondition cndCondition in ((CompositeCondition)p_cndCondition).Conditions)
				{
					XElement xelCondition = UnparseCondition(cndCondition);
					if (xelCondition != null)
						xelCompositeCondition.Add(xelCondition);
				}
				return xelCompositeCondition;
			}
			if (p_cndCondition is GameVersionCondition)
			{
				XElement xelGameVersion = new XElement("falloutDependency",
														new XAttribute("version", ((GameVersionCondition)p_cndCondition).MinimumVersion.ToString()));
				return xelGameVersion;
			}
			if (p_cndCondition is ModManagerCondition)
			{
				XElement xelManagerVersion = new XElement("fommDependency",
														new XAttribute("version", ((ModManagerCondition)p_cndCondition).MinimumVersion.ToString()));
				return xelManagerVersion;
			}
			if (p_cndCondition is FlagCondition)
			{
				XElement xelFlag = new XElement("flagDependency",
												new XAttribute("flag", ((FlagCondition)p_cndCondition).FlagName),
												new XAttribute("value", ((FlagCondition)p_cndCondition).Value));
				return xelFlag;
			}
			if (p_cndCondition is PluginCondition)
			{
				XElement xelPlugin = new XElement("fileDependency",
												new XAttribute("file", ((PluginCondition)p_cndCondition).PluginPath),
												new XAttribute("state", UnparsePluginState(((PluginCondition)p_cndCondition).State)));
				return xelPlugin;
			}
			return null;
		}

		/// <summary>
		/// Unparses the given <see cref="Option"/>.
		/// </summary>
		/// <remarks>
		/// This method can be overidden to provide game-specific or newer-version unparsing.
		/// </remarks>
		/// <param name="p_optOption">The <see cref="Option"/> for which to generate XML.</param>
		/// <returns>The XML representation of the given <see cref="Option"/>.</returns>
		protected override XElement UnparseOption(Option p_optOption)
		{
			XElement xelOption = new XElement("plugin",
									new XAttribute("name", p_optOption.Name),
									new XElement("description",
										new XCData(p_optOption.Description)));
			if (!String.IsNullOrEmpty(p_optOption.ImagePath))
			{
				XElement xelImage = new XElement("image",
										new XAttribute("path", p_optOption.ImagePath));
				xelOption.Add(xelImage);
			}
			if (!p_optOption.Flags.IsNullOrEmpty())
			{
				XElement xelFlags = new XElement("conditionFlags");
				xelOption.Add(xelFlags);
				foreach (ConditionalFlag flgFlag in p_optOption.Flags)
					xelFlags.Add(UnparseConditionalFlag(flgFlag));
			}
			if (!p_optOption.Files.IsNullOrEmpty())
			{
				XElement xelFiles = new XElement("files");
				xelOption.Add(xelFiles);
				foreach (InstallableFile iflFile in p_optOption.Files)
					xelFiles.Add(UnparseInstallableFile(iflFile));
			}
			xelOption.Add(UnparseOptionTypeResolver(p_optOption.OptionTypeResolver));
			return xelOption;
		}

		/// <summary>
		/// Unparses the given <see cref="IOptionTypeResolver"/>.
		/// </summary>
		/// <remarks>
		/// This method can be overidden to provide game-specific or newer-version unparsing.
		/// </remarks>
		/// <param name="p_otrOptionTypeResolver">The <see cref="IOptionTypeResolver"/> for which to generate XML.</param>
		/// <returns>The XML representation of the given <see cref="IOptionTypeResolver"/>.</returns>
		protected override XElement UnparseOptionTypeResolver(IOptionTypeResolver p_otrOptionTypeResolver)
		{
			XElement xelTypeDescriptor = new XElement("typeDescriptor");
			if (p_otrOptionTypeResolver is StaticOptionTypeResolver)
			{
				XElement xelPluginType = new XElement("type",
											new XAttribute("name", UnparseOptionType(((StaticOptionTypeResolver)p_otrOptionTypeResolver).Type)));
				xelTypeDescriptor.Add(xelPluginType);
			}
			else if (p_otrOptionTypeResolver is ConditionalOptionTypeResolver)
			{
				XElement xelPluginType = new XElement("dependencyType");
				xelTypeDescriptor.Add(xelPluginType);
				XElement xelDefaultType = new XElement("defaultType",
												new XAttribute("name", UnparseOptionType(((ConditionalOptionTypeResolver)p_otrOptionTypeResolver).DefaultType)));
				xelPluginType.Add(xelDefaultType);
				XElement xelPatterns = new XElement("patterns");
				xelPluginType.Add(xelPatterns);
				foreach (ConditionalOptionTypeResolver.ConditionalTypePattern ctpPattern in ((ConditionalOptionTypeResolver)p_otrOptionTypeResolver).ConditionalTypePatterns)
					xelPatterns.Add(UnparseConditionalTypePattern(ctpPattern));
			}
			else
				throw new UnsupportedScriptFeatureException("Unsupported Option Type Resolver: " + p_otrOptionTypeResolver.GetType().FullName);
			return xelTypeDescriptor;
		}

		/// <summary>
		/// Unparses the given <see cref="ConditionalOptionTypeResolver.ConditionalTypePattern"/>.
		/// </summary>
		/// <remarks>
		/// This method can be overidden to provide game-specific or newer-version unparsing.
		/// </remarks>
		/// <param name="p_ctpPattern">The <see cref="ConditionalOptionTypeResolver.ConditionalTypePattern"/> for which to generate XML.</param>
		/// <returns>The XML representation of the given <see cref="ConditionalOptionTypeResolver.ConditionalTypePattern"/>.</returns>
		protected override XElement UnparseConditionalTypePattern(ConditionalOptionTypeResolver.ConditionalTypePattern p_ctpPattern)
		{
			XElement xelPattern = new XElement("pattern");
			if (p_ctpPattern.Condition is CompositeCondition)
				xelPattern.Add(UnparseCondition(p_ctpPattern.Condition));
			else
			{
				XElement xelCompositeCondition = new XElement("dependencies",
													UnparseCondition(p_ctpPattern.Condition));
				xelPattern.Add(xelCompositeCondition);
			}
			XElement xelType = new XElement("type",
									new XAttribute("name", UnparseOptionType(p_ctpPattern.Type)));
			xelPattern.Add(xelType);
			return xelPattern;
		}

		/// <summary>
		/// Unparses the given <see cref="ConditionalFlag"/>.
		/// </summary>
		/// <remarks>
		/// This method can be overidden to provide game-specific or newer-version unparsing.
		/// </remarks>
		/// <param name="p_flgFlag">The <see cref="ConditionalFlag"/> for which to generate XML.</param>
		/// <returns>The XML representation of the given <see cref="ConditionalFlag"/>.</returns>
		protected virtual XElement UnparseConditionalFlag(ConditionalFlag p_flgFlag)
		{
			XElement xelFlag = new XElement("flag",
									new XAttribute("name", p_flgFlag.Name));
			xelFlag.Value = p_flgFlag.ConditionalValue;
			return xelFlag;
		}

		/// <summary>
		/// Unparses the given <see cref="ConditionallyInstalledFileSet"/>.
		/// </summary>
		/// <remarks>
		/// This method can be overidden to provide game-specific or newer-version unparsing.
		/// </remarks>
		/// <param name="p_cifFileSet">The <see cref="ConditionallyInstalledFileSet"/> for which to generate XML.</param>
		/// <returns>The XML representation of the given <see cref="ConditionallyInstalledFileSet"/>.</returns>
		protected virtual XElement UnparseConditionallyInstalledFileSet(ConditionallyInstalledFileSet p_cifFileSet)
		{
			XElement xelFileSet = new XElement("pattern");
			if (p_cifFileSet.Condition is CompositeCondition)
				xelFileSet.Add(UnparseCondition(p_cifFileSet.Condition));
			else
			{
				XElement xelCompositeCondition = new XElement("dependencies",
														UnparseCondition(p_cifFileSet.Condition));
				xelFileSet.Add(xelCompositeCondition);
			}
			XElement xelFiles = new XElement("files");
			xelFileSet.Add(xelFiles);
			foreach (InstallableFile iflFile in p_cifFileSet.Files)
				xelFiles.Add(UnparseInstallableFile(iflFile));
			return xelFileSet;
		}

		#endregion
	}
}
