/**
 * External dependencies
 */
import { useExcludedSettings } from '@qlse/store';
/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

//TODO: uncomment when WP 6.6 is the minimum version required
// import { PluginDocumentSettingPanel } from '@wordpress/editor';
import { CheckboxControl } from '@wordpress/components';
import { useState, useEffect, useRef } from '@wordpress/element';
import { select, subscribe } from '@wordpress/data';
/**
 * Internal dependencies
 */
import { useExcludeMeta } from '../../helpers/hooks';

export const Metabox = () => {
	/**
	 * PluginDocumentSettingPanel - Supporting multiple WordPress versions (fix undefined import in wp versions before 6.6)
	 *
	 *
	 * https://make.wordpress.org/core/2024/06/18/editor-unified-extensibility-apis-in-6-6/
	 *
	 *
	 * The wp.editPost and wp.editSite slots will continue to work without changes, but the old slot locations will be deprecated.
	 * To avoid triggering console warnings, you can support both the new and old slots at the same time.
	 *
	 * Once you are ready to make WP 6.6 the minimum required version for your plugin, you should be able to drop the fallbacks and restore the initial code.
	 */
	const PluginDocumentSettingPanel =
		wp.editor?.PluginDocumentSettingPanel ??
		wp.editPost?.PluginDocumentSettingPanel ??
		wp.editSite?.PluginDocumentSettingPanel;

	const {
		settingsExcluded: excluded,
		hasResolvedSettingsExcluded,
		saveExcludedSettings,
	} = useExcludedSettings();

	const { exclude, setExclude } = useExcludeMeta();

	const [postExcluded, setPostExcluded] = useState([]);
	const postId = select('core/editor').getCurrentPostId();
	const isSavingRef = useRef(false);

	useEffect(() => {
		if (hasResolvedSettingsExcluded) {
			setPostExcluded(excluded);
		}
	}, [hasResolvedSettingsExcluded]);

	useEffect(() => {
		const unsubscribe = subscribe(() => {
			const isSavingPost = select('core/editor').isSavingPost();
			const isAutosavingPost = select('core/editor').isAutosavingPost();

			if (isSavingPost && !isAutosavingPost && !isSavingRef.current) {
				isSavingRef.current = true;
				saveExcludedSettings(postExcluded);
			}

			if (!isSavingPost) {
				isSavingRef.current = false;
			}
		});

		return () => unsubscribe();
	}, [postExcluded]);

	const handleChange = () => {
		setPostExcluded((prevExcluded) => {
			const updatedExcluded = prevExcluded.includes(postId)
				? prevExcluded.filter(
						(excludedPostId) => excludedPostId !== postId
				  )
				: [...prevExcluded, postId];

			setExclude(exclude ? undefined : true);

			return updatedExcluded;
		});
	};

	return (
		<PluginDocumentSettingPanel
			title="Search Exclude"
			name="search-exclude"
		>
			<CheckboxControl
				__nextHasNoMarginBottom
				label={__('Exclude from Search Results', 'search-exclude')}
				checked={postExcluded?.includes(postId)}
				onChange={handleChange}
			/>
		</PluginDocumentSettingPanel>
	);
};
