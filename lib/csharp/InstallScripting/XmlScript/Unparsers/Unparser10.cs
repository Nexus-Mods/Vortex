using System;
using System.Collections.Generic;
using System.Xml.Linq;

namespace Nexus.Client.ModManagement.Scripting.XmlScript.Unparsers
{
	/// <summary>
	/// Unparses version 1.0 XML scripts.
	/// </summary>
	public class Unparser10 : Unparser
	{
		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_xscScript">The script to unparse.</param>
		public Unparser10(XmlScript p_xscScript)
			: base(p_xscScript)
		{
		}

		#endregion

		#region Abstract Method Implementations

		/// <summary>
		/// Unparses <see cref="XmlScript.HeaderInfo"/>.
		/// </summary>
		/// <returns>An XML representation of the <see cref="Script"/>'s <see cref="XmlScript.HeaderInfo"/>.</returns>
		protected override List<XElement> UnparseHeaderInfo()
		{
			XElement xelHeader = new XElement("moduleName");
			xelHeader.Value = Script.HeaderInfo.Title;
			return new List<XElement>() { xelHeader };
		}

		/// <summary>
		/// Unparses <see cref="XmlScript.ModPrerequisites"/>.
		/// </summary>
		/// <returns>An XML representation of the <see cref="Script"/>'s <see cref="XmlScript.ModPrerequisites"/>,
		/// or <c>null</c> if the script doean't have any <see cref="XmlScript.ModPrerequisites"/>.</returns>
		protected override XElement UnparseModPrerequisites()
		{
			if (Script.ModPrerequisites == null)
				return null;

			XElement xelPrerequisites = new XElement("moduleDependancies");
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
		/// Unparses <see cref="XmlScript.RequiredInstallFiles"/>.
		/// </summary>
		/// <returns>An XML representation of the <see cref="Script"/>'s <see cref="XmlScript.RequiredInstallFiles"/>,
		/// or <c>null</c> if the script doean't have any <see cref="XmlScript.RequiredInstallFiles"/>.</returns>
		protected override XElement UnparseRequiredInstallFiles()
		{
			XElement xelRequiredFiles = null;
			if (Script.RequiredInstallFiles.Count > 0)
			{
				xelRequiredFiles = new XElement("requiredInstallFiles");
				foreach (InstallableFile iflFile in Script.RequiredInstallFiles)
				{
					XElement xelFile = UnparseInstallableFile(iflFile);
					xelRequiredFiles.Add(xelFile);
				}
			}
			return xelRequiredFiles;
		}

		/// <summary>
		/// Unparses <see cref="XmlScript.InstallSteps"/>.
		/// </summary>
		/// <returns>An XML representation of the <see cref="Script"/>'s <see cref="XmlScript.InstallSteps"/>,
		/// or <c>null</c> if the script doean't have any <see cref="XmlScript.InstallSteps"/>.</returns>
		protected override XElement UnparseInstallSteps()
		{
			if (Script.InstallSteps.Count > 0)
				return UnparseInstallStep(Script.InstallSteps[0]);
			return null;
		}

		/// <summary>
		/// Unparses <see cref="XmlScript.ConditionallyInstalledFileSets"/>.
		/// </summary>
		/// <returns>An XML representation of the <see cref="Script"/>'s <see cref="XmlScript.ConditionallyInstalledFileSets"/>,
		/// or <c>null</c> if the script doean't have any <see cref="XmlScript.ConditionallyInstalledFileSets"/>.</returns>
		protected override XElement UnparseConditionallyInstalledFileSets()
		{
			return null;
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
		protected virtual XElement UnparsePrerequisiteCondition(ICondition p_cndCondition)
		{
			if (p_cndCondition is PluginCondition)
			{
				XElement xelPlugin = new XElement("fileDependancy",
													new XAttribute("file",((PluginCondition)p_cndCondition).PluginPath));
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
		protected virtual XElement UnparseCondition(ICondition p_cndCondition)
		{
			if (p_cndCondition is CompositeCondition)
			{
				XElement xelCompositeCondition = new XElement("dependancies",
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
				XElement xelGameVersion = new XElement("falloutDependancy",
														new XAttribute("version", ((GameVersionCondition)p_cndCondition).MinimumVersion.ToString()));
				return xelGameVersion;
			}
			if (p_cndCondition is ModManagerCondition)
			{
				XElement xelManagerVersion = new XElement("fommDependancy",
														new XAttribute("version", ((ModManagerCondition)p_cndCondition).MinimumVersion.ToString()));
				return xelManagerVersion;
			}
			if (p_cndCondition is PluginCondition)
			{
				XElement xelPlugin = new XElement("dependancy",
													new XAttribute("file", ((PluginCondition)p_cndCondition).PluginPath),
													new XAttribute("state", UnparsePluginState(((PluginCondition)p_cndCondition).State)));
				return xelPlugin;
			}
			return null;
		}

		/// <summary>
		/// Unparses the given <see cref="InstallableFile"/>.
		/// </summary>
		/// <remarks>
		/// This method can be overidden to provide game-specific or newer-version unparsing.
		/// </remarks>
		/// <param name="p_iflFile">The <see cref="InstallableFile"/> for which to generate XML.</param>
		/// <returns>The XML representation of the given <see cref="InstallableFile"/>.</returns>
		protected virtual XElement UnparseInstallableFile(InstallableFile p_iflFile)
		{
			XElement xelFile = null;
			if (p_iflFile.IsFolder)
				xelFile = new XElement("folder");
			else
				xelFile = new XElement("file");

			xelFile.Add(new XAttribute("source", p_iflFile.Source));
			xelFile.Add(new XAttribute("destination", p_iflFile.Destination));
			xelFile.Add(new XAttribute("alwaysInstall", UnparseBoolean(p_iflFile.AlwaysInstall)));
			xelFile.Add(new XAttribute("installIfUsable", UnparseBoolean(p_iflFile.InstallIfUsable)));
			xelFile.Add(new XAttribute("priority", p_iflFile.Priority.ToString()));

			return xelFile;
		}

		/// <summary>
		/// Unparses the given <see cref="InstallStep"/>.
		/// </summary>
		/// <remarks>
		/// This method can be overidden to provide game-specific or newer-version unparsing.
		/// </remarks>
		/// <param name="p_ispStep">The <see cref="InstallStep"/> for which to generate XML.</param>
		/// <returns>The XML representation of the given <see cref="InstallStep"/>.</returns>
		protected virtual XElement UnparseInstallStep(InstallStep p_ispStep)
		{
			XElement xelStep = null;
			if (p_ispStep.OptionGroups.Count > 0)
			{
				xelStep = new XElement("optionalFileGroups");
				foreach (OptionGroup ogpGroup in p_ispStep.OptionGroups)
					xelStep.Add(UnparseOptionGroup(ogpGroup));
			}
			return xelStep;
		}

		/// <summary>
		/// Unparses the given <see cref="OptionGroup"/>.
		/// </summary>
		/// <remarks>
		/// This method can be overidden to provide game-specific or newer-version unparsing.
		/// </remarks>
		/// <param name="p_ogpGroup">The <see cref="OptionGroup"/> for which to generate XML.</param>
		/// <returns>The XML representation of the given <see cref="OptionGroup"/>.</returns>
		protected virtual XElement UnparseOptionGroup(OptionGroup p_ogpGroup)
		{
			XElement xelGroup = new XElement("group",
											new XAttribute("name", p_ogpGroup.Name),
											new XAttribute("type", UnparseOptionGroupType(p_ogpGroup.Type)));
			XElement xelOptions = new XElement("plugins");
			xelGroup.Add(xelOptions);
			foreach (Option optOption in p_ogpGroup.Options)
				xelOptions.Add(UnparseOption(optOption));
			return xelGroup;
		}

		/// <summary>
		/// Unparses the given <see cref="Option"/>.
		/// </summary>
		/// <remarks>
		/// This method can be overidden to provide game-specific or newer-version unparsing.
		/// </remarks>
		/// <param name="p_optOption">The <see cref="Option"/> for which to generate XML.</param>
		/// <returns>The XML representation of the given <see cref="Option"/>.</returns>
		protected virtual XElement UnparseOption(Option p_optOption)
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
			XElement xelFiles = new XElement("files");
			xelOption.Add(xelFiles);
			foreach (InstallableFile iflFile in p_optOption.Files)
				xelFiles.Add(UnparseInstallableFile(iflFile));
			xelOption.Add(UnparseOptionTypeResolver(p_optOption.OptionTypeResolver));
			return xelOption;

			//the code below is the same, but with the parts reoreder to match VS2008 auto-xml file generator
			// output
			//the order in the block above is my preferred order
			/*XElement xelOption = new XElement("plugin");
			xndOption.Attributes.Append(Document.CreateAttribute("name")).Value = p_optOption.Name;
			xndOption.AppendChild(UnparseOptionTypeResolver(p_optOption.OptionTypeResolver));
			if (!String.IsNullOrEmpty(p_optOption.ImagePath))
			{
				XElement xelImage = xndOption.AppendChild(new XElement("image"));
				xndImage.Attributes.Append(Document.CreateAttribute("path")).Value = p_optOption.ImagePath;
			}
			xndOption.AppendChild(new XElement("description")).AppendChild(Document.CreateCDataSection(p_optOption.Description));
			XElement xelFiles = xndOption.AppendChild(new XElement("files"));
			foreach (InstallableFile iflFile in p_optOption.Files)
				xndFiles.AppendChild(UnparseInstallableFile(iflFile));
			return xndOption;*/
		}

		/// <summary>
		/// Unparses the given <see cref="IOptionTypeResolver"/>.
		/// </summary>
		/// <remarks>
		/// This method can be overidden to provide game-specific or newer-version unparsing.
		/// </remarks>
		/// <param name="p_otrOptionTypeResolver">The <see cref="IOptionTypeResolver"/> for which to generate XML.</param>
		/// <returns>The XML representation of the given <see cref="IOptionTypeResolver"/>.</returns>
		protected virtual XElement UnparseOptionTypeResolver(IOptionTypeResolver p_otrOptionTypeResolver)
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
				XElement xelPluginType = new XElement("dependancyType");
				xelTypeDescriptor.Add(xelPluginType);
				XElement xelDefaultType =new XElement("defaultType",
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
		protected virtual XElement UnparseConditionalTypePattern(ConditionalOptionTypeResolver.ConditionalTypePattern p_ctpPattern)
		{
			XElement xelPattern = new XElement("pattern");
			if (p_ctpPattern.Condition is CompositeCondition)
				xelPattern.Add(UnparseCondition(p_ctpPattern.Condition));
			else
			{
				XElement xelCompositeCondition = new XElement("dependancies",
																UnparseCondition(p_ctpPattern.Condition));
				xelPattern.Add(xelCompositeCondition);
			}
			XElement xelType = new XElement("type",
											new XAttribute("name", UnparseOptionType(p_ctpPattern.Type)));
			xelPattern.Add(xelType);
			return xelPattern;
		}

		#endregion
	}
}
