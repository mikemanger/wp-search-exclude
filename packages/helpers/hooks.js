import { useSelect, useDispatch } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';
import { store as coreStore } from '@wordpress/core-data';

export const useExcludeMeta = (props = {}) => {
	const { meta, setMeta } = useCurrentPostMeta(props);
	const setExclude = (newValue) => {
		setMeta({
			_exclude: newValue,
		});
	};
	return {
		exclude: meta?._exclude,
		setExclude,
	};
};
export const useCurrentPostMeta = (props = {}) => {
	const { context = {} } = props;
	const { meta, postType, postId } = useSelect(
		(select) => {
			const { getEditedEntityRecord } = select(coreStore);
			const { getCurrentPostId, getCurrentPostType } =
				select(editorStore);
			const {
				postType = getCurrentPostType(),
				postId = getCurrentPostId(),
			} = context;
			const post = getEditedEntityRecord('postType', postType, postId);
			return {
				meta: post?.meta,
				postType,
				postId,
			};
		},
		[context]
	);
	const { editEntityRecord } = useDispatch(coreStore);
	const setMeta = (newValue) => {
		editEntityRecord('postType', postType, postId, {
			meta: {
				...meta,
				...newValue,
			},
		});
	};
	return {
		meta,
		setMeta,
	};
};

export const usePostTypes = ({ postType = 'page', limit = -1 } = {}) => {
	return useSelect(
		(select) => {
			const { getEntityRecords, isResolving, hasFinishedResolution } =
				select(coreStore);
			// Build the query parameters
			const query = {
				per_page: limit,
			};

			const params = ['postType', postType, query];
			const postTypes = getEntityRecords(...params);
			const isResolvingPostTypes = isResolving(
				'getEntityRecords',
				params
			);

			const hasResolvedPostTypes = hasFinishedResolution(
				'getEntityRecords',
				params
			);
			const hasPostTypes = !isResolvingPostTypes && !!postTypes?.length;

			return {
				postTypes,
				isResolvingPostTypes,
				hasPostTypes,
				hasResolvedPostTypes,
			};
		},
		[postType, limit]
	);
};
export const usePostsByIds = (ids = [], postType = 'post') => {
	return useSelect(
		(select) => {
			const { getEntityRecords, isResolving, hasFinishedResolution } =
				select(coreStore);

			const query = {
				include: ids,
				per_page: ids.length,
				_fields: ['id', 'title', 'date', 'link'],
			};

			const posts = getEntityRecords('postType', postType, query);

			const isResolvingPosts = isResolving('getEntityRecords', [
				'postType',
				postType,
				query,
			]);

			const hasResolvedPosts = hasFinishedResolution('getEntityRecords', [
				'postType',
				postType,
				query,
			]);

			const hasPosts = !isResolvingPosts && !!posts?.length;

			const postsData = hasPosts
				? posts.map(({ id, title, date, link }) => ({
						id,
						title: title.rendered,
						date,
						link,
				  }))
				: [];

			return {
				posts: postsData,
				isResolvingPosts,
				hasPosts,
				hasResolvedPosts,
			};
		},
		[ids.join(','), postType]
	);
};

export const useValidPostTypes = () => {
	return useSelect(
		(select) => {
			const { getPostTypes, isResolving, hasFinishedResolution } =
				select(coreStore);

			const query = { per_page: -1 };
			const postTypes = getPostTypes(query);

			const isResolvingPostTypes = isResolving('getPostTypes', [query]);
			const hasResolvedPostTypes = hasFinishedResolution('getPostTypes', [
				query,
			]);

			if (isResolvingPostTypes || !hasResolvedPostTypes || !postTypes) {
				return {
					validPostTypes: [],
					isResolvingPostTypes: true,
					hasResolvedPostTypes: false,
				};
			}

			// Filter out post types that are not public or are internal
			const validPostTypes = postTypes.filter(
				(postType) =>
					postType.viewable && !postType.slug.startsWith('wp_')
			);

			return {
				validPostTypes,
				isResolvingPostTypes: false,
				hasResolvedPostTypes: true,
			};
		},
		[] // No dependencies; runs once unless select dependencies change
	);
};

export const usePostsByIdsAnyPostType = (ids = [], validPostTypes = []) => {
	// Call useValidPostTypes unconditionally
	const {
		validPostTypes: fetchedPostTypes,
		isResolvingPostTypes,
		hasResolvedPostTypes,
	} = useValidPostTypes();

	// Decide which validPostTypes to use
	const resolvedValidPostTypes = validPostTypes.length
		? validPostTypes
		: fetchedPostTypes;

	// Now use useSelect to fetch the posts
	const { postsData, isResolvingPosts, hasResolvedPosts } = useSelect(
		(select) => {
			const { getEntityRecords, isResolving, hasFinishedResolution } =
				select(coreStore);

			// Check if post types are resolving
			if (
				isResolvingPostTypes ||
				!hasResolvedPostTypes ||
				!resolvedValidPostTypes.length
			) {
				return {
					postsData: [],
					isResolvingPosts: true,
					hasResolvedPosts: false,
				};
			}

			// Initialize variables to collect posts and resolution states
			let allPosts = [];
			let isResolvingAllPosts = false;
			let hasResolvedAllPosts = true;

			// Loop through each valid post type and fetch posts with the given IDs
			resolvedValidPostTypes.forEach((postType) => {
				const query = {
					include: ids,
					per_page: ids.length, // ids.length is at least 1 here
					_fields: ['id', 'title', 'date', 'link', 'type'],
				};

				const posts = getEntityRecords(
					'postType',
					postType.slug,
					query
				);

				const isResolvingCurrent = isResolving('getEntityRecords', [
					'postType',
					postType.slug,
					query,
				]);

				const hasResolvedCurrent = hasFinishedResolution(
					'getEntityRecords',
					['postType', postType.slug, query]
				);

				// Update resolving states
				isResolvingAllPosts = isResolvingAllPosts || isResolvingCurrent;
				hasResolvedAllPosts = hasResolvedAllPosts && hasResolvedCurrent;

				if (posts && posts.length) {
					allPosts = allPosts.concat(
						posts.map(({ id, title, date, link, type }) => ({
							id,
							title: title.rendered,
							date,
							link,
							postType: type,
						}))
					);
				}
			});

			return {
				postsData: allPosts,
				isResolvingPosts: isResolvingAllPosts,
				hasResolvedPosts: hasResolvedAllPosts,
			};
		},
		[ids.join(','), resolvedValidPostTypes.map((pt) => pt.slug).join(',')] // Dependencies
	);

	const hasPosts = !isResolvingPosts && postsData.length > 0;

	return {
		posts: postsData,
		isResolvingPosts,
		hasPosts,
		hasResolvedPosts,
	};
};

// export const usePostsByIdsAnyPostType = (ids = []) => {
// 	return useSelect(
// 		(select) => {
// 			const {
// 				getEntityRecords,
// 				isResolving,
// 				hasFinishedResolution,
// 				getPostTypes,
// 			} = select(coreStore);

// 			// Fetch all post types
// 			const postTypes = getPostTypes({ per_page: -1 });

// 			// Check if post types are resolving
// 			const isResolvingPostTypes = isResolving('getPostTypes', [
// 				{ per_page: -1 },
// 			]);
// 			const hasResolvedPostTypes = hasFinishedResolution('getPostTypes', [
// 				{ per_page: -1 },
// 			]);

// 			if (isResolvingPostTypes || !hasResolvedPostTypes || !postTypes) {
// 				return {
// 					posts: [],
// 					isResolvingPosts: true,
// 					hasPosts: false,
// 					hasResolvedPosts: false,
// 				};
// 			}

// 			// Filter out post types that are not public or not hierarchical
// 			const validPostTypes = postTypes.filter(
// 				(postType) =>
// 					postType.viewable && !postType.slug.startsWith('wp_')
// 			);

// 			// Initialize variables to collect posts and resolution states
// 			let allPosts = [];
// 			let isResolvingPosts = false;
// 			let hasResolvedPosts = true;

// 			// Loop through each post type and fetch posts with the given IDs
// 			validPostTypes.forEach((postType) => {
// 				const query = {
// 					include: ids,
// 					per_page: ids.length,
// 					_fields: ['id', 'title', 'date', 'link', 'type'],
// 				};

// 				const posts = getEntityRecords(
// 					'postType',
// 					postType.slug,
// 					query
// 				);

// 				const isResolvingCurrent = isResolving('getEntityRecords', [
// 					'postType',
// 					postType.slug,
// 					query,
// 				]);

// 				const hasResolvedCurrent = hasFinishedResolution(
// 					'getEntityRecords',
// 					['postType', postType.slug, query]
// 				);

// 				// Update resolving states
// 				isResolvingPosts = isResolvingPosts || isResolvingCurrent;
// 				hasResolvedPosts = hasResolvedPosts && hasResolvedCurrent;

// 				if (posts && posts.length) {
// 					allPosts = allPosts.concat(
// 						posts.map(({ id, title, date, link, type }) => ({
// 							id,
// 							title: title.rendered,
// 							date,
// 							link,
// 							postType: type,
// 						}))
// 					);
// 				}
// 			});

// 			const hasPosts = !isResolvingPosts && allPosts.length > 0;

// 			return {
// 				posts: allPosts,
// 				isResolvingPosts,
// 				hasPosts,
// 				hasResolvedPosts,
// 			};
// 		},
// 		[ids.join(',')] // Dependency array to re-run the hook when IDs change
// 	);
// };
