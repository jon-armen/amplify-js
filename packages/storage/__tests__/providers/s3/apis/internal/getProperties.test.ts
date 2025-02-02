// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AWSCredentials } from '@aws-amplify/core/internals/utils';
import { Amplify, StorageAccessLevel } from '@aws-amplify/core';

import { headObject } from '../../../../../src/providers/s3/utils/client/s3data';
import { getProperties } from '../../../../../src/providers/s3/apis/internal/getProperties';
import {
	GetPropertiesInput,
	GetPropertiesOutput,
	GetPropertiesWithPathInput,
	GetPropertiesWithPathOutput,
} from '../../../../../src/providers/s3/types';
import './testUtils';
import { BucketInfo } from '../../../../../src/providers/s3/types/options';

jest.mock('../../../../../src/providers/s3/utils/client/s3data');
jest.mock('@aws-amplify/core', () => ({
	ConsoleLogger: jest.fn().mockImplementation(function ConsoleLogger() {
		return { debug: jest.fn() };
	}),
	Amplify: {
		getConfig: jest.fn(),
		Auth: {
			fetchAuthSession: jest.fn(),
		},
	},
}));
const mockHeadObject = headObject as jest.MockedFunction<typeof headObject>;
const mockFetchAuthSession = Amplify.Auth.fetchAuthSession as jest.Mock;
const mockGetConfig = jest.mocked(Amplify.getConfig);

const bucket = 'bucket';
const region = 'region';
const credentials: AWSCredentials = {
	accessKeyId: 'accessKeyId',
	sessionToken: 'sessionToken',
	secretAccessKey: 'secretAccessKey',
};
const inputKey = 'key';
const inputPath = 'path';
const targetIdentityId = 'targetIdentityId';
const defaultIdentityId = 'defaultIdentityId';
const validBucketOwner = '111122223333';
const invalidBucketOwner = '123';

const expectedResult = {
	size: 100,
	contentType: 'text/plain',
	eTag: 'etag',
	metadata: { key: 'value' },
	lastModified: new Date('01-01-1980'),
	versionId: 'version-id',
};

describe('getProperties with key', () => {
	const getPropertiesWrapper = (input: GetPropertiesInput) =>
		getProperties(Amplify, input);
	beforeAll(() => {
		mockFetchAuthSession.mockResolvedValue({
			credentials,
			identityId: defaultIdentityId,
		});
		mockGetConfig.mockReturnValue({
			Storage: {
				S3: {
					bucket,
					region,
					buckets: { 'default-bucket': { bucketName: bucket, region } },
				},
			},
		});
	});

	describe('Happy cases: With key', () => {
		const config = {
			credentials,
			region,
			userAgentValue: expect.any(String),
		};
		beforeEach(() => {
			mockHeadObject.mockResolvedValue({
				ContentLength: 100,
				ContentType: 'text/plain',
				ETag: 'etag',
				LastModified: new Date('01-01-1980'),
				Metadata: { key: 'value' },
				VersionId: 'version-id',
				$metadata: {} as any,
			});
		});
		afterEach(() => {
			jest.clearAllMocks();
		});

		const testCases: {
			expectedKey: string;
			options?: { accessLevel?: StorageAccessLevel; targetIdentityId?: string };
		}[] = [
			{
				expectedKey: `public/${inputKey}`,
			},
			{
				options: { accessLevel: 'guest' },
				expectedKey: `public/${inputKey}`,
			},
			{
				options: { accessLevel: 'private' },
				expectedKey: `private/${defaultIdentityId}/${inputKey}`,
			},
			{
				options: { accessLevel: 'protected' },
				expectedKey: `protected/${defaultIdentityId}/${inputKey}`,
			},
			{
				options: { accessLevel: 'protected', targetIdentityId },
				expectedKey: `protected/${targetIdentityId}/${inputKey}`,
			},
		];
		test.each(testCases)(
			'should getProperties with key $expectedKey',
			async ({ options, expectedKey }) => {
				const headObjectOptions = {
					Bucket: 'bucket',
					Key: expectedKey,
				};
				const {
					key,
					contentType,
					eTag,
					lastModified,
					metadata,
					size,
					versionId,
				} = (await getPropertiesWrapper({
					key: inputKey,
					options,
				})) as GetPropertiesOutput;
				expect({
					key,
					contentType,
					eTag,
					lastModified,
					metadata,
					size,
					versionId,
				}).toEqual({
					key: inputKey,
					...expectedResult,
				});
				expect(headObject).toHaveBeenCalledTimes(1);
				await expect(headObject).toBeLastCalledWithConfigAndInput(
					config,
					headObjectOptions,
				);
			},
		);

		describe('bucket passed in options', () => {
			it('should override bucket in headObject call when bucket is object', async () => {
				const bucketInfo: BucketInfo = {
					bucketName: 'bucket-1',
					region: 'region-1',
				};
				const headObjectOptions = {
					Bucket: bucketInfo.bucketName,
					Key: `public/${inputKey}`,
				};

				await getPropertiesWrapper({
					key: inputKey,
					options: {
						bucket: bucketInfo,
					},
				});
				expect(headObject).toHaveBeenCalledTimes(1);
				await expect(headObject).toBeLastCalledWithConfigAndInput(
					{
						credentials,
						region: bucketInfo.region,

						userAgentValue: expect.any(String),
					},
					headObjectOptions,
				);
			});
			it('should override bucket in headObject call when bucket is string', async () => {
				await getPropertiesWrapper({
					key: inputKey,
					options: {
						bucket: 'default-bucket',
					},
				});
				expect(headObject).toHaveBeenCalledTimes(1);
				await expect(headObject).toBeLastCalledWithConfigAndInput(
					{
						credentials,
						region,
						userAgentValue: expect.any(String),
					},
					{
						Bucket: bucket,
						Key: `public/${inputKey}`,
					},
				);
			});
		});
	});

	describe('Error cases :  With key', () => {
		afterEach(() => {
			jest.clearAllMocks();
		});
		it('getProperties should return a not found error', async () => {
			mockHeadObject.mockRejectedValueOnce(
				Object.assign(new Error(), {
					$metadata: { httpStatusCode: 404 },
					name: 'NotFound',
				}),
			);
			expect.assertions(3);
			try {
				await getPropertiesWrapper({ key: inputKey });
			} catch (error: any) {
				expect(headObject).toHaveBeenCalledTimes(1);
				await expect(headObject).toBeLastCalledWithConfigAndInput(
					{
						credentials,
						region: 'region',
						userAgentValue: expect.any(String),
					},
					{
						Bucket: 'bucket',
						Key: `public/${inputKey}`,
					},
				);
				expect(error.$metadata.httpStatusCode).toBe(404);
			}
		});
	});
});

describe('Happy cases: With path', () => {
	const getPropertiesWrapper = (input: GetPropertiesWithPathInput) =>
		getProperties(Amplify, input);
	beforeAll(() => {
		mockFetchAuthSession.mockResolvedValue({
			credentials,
			identityId: defaultIdentityId,
		});
		mockGetConfig.mockReturnValue({
			Storage: {
				S3: {
					bucket,
					region,
					buckets: { 'default-bucket': { bucketName: bucket, region } },
				},
			},
		});
	});
	describe('getProperties with path', () => {
		const config = {
			credentials,
			region: 'region',
			useAccelerateEndpoint: true,
			userAgentValue: expect.any(String),
		};
		beforeEach(() => {
			mockHeadObject.mockResolvedValue({
				ContentLength: 100,
				ContentType: 'text/plain',
				ETag: 'etag',
				LastModified: new Date('01-01-1980'),
				Metadata: { key: 'value' },
				VersionId: 'version-id',
				$metadata: {} as any,
			});
		});
		afterEach(() => {
			jest.clearAllMocks();
		});
		test.each([
			{
				testPath: inputPath,
				expectedPath: inputPath,
			},
			{
				testPath: () => inputPath,
				expectedPath: inputPath,
			},
		])(
			'should getProperties with path $path and expectedPath $expectedPath',
			async ({ testPath, expectedPath }) => {
				const headObjectOptions = {
					Bucket: 'bucket',
					Key: expectedPath,
				};
				const {
					path,
					contentType,
					eTag,
					lastModified,
					metadata,
					size,
					versionId,
				} = (await getPropertiesWrapper({
					path: testPath,
					options: {
						useAccelerateEndpoint: true,
					},
				})) as GetPropertiesWithPathOutput;
				expect({
					path,
					contentType,
					eTag,
					lastModified,
					metadata,
					size,
					versionId,
				}).toEqual({
					path: expectedPath,
					...expectedResult,
				});
				expect(headObject).toHaveBeenCalledTimes(1);
				await expect(headObject).toBeLastCalledWithConfigAndInput(
					config,
					headObjectOptions,
				);
			},
		);
		describe('bucket passed in options', () => {
			it('should override bucket in headObject call when bucket is object', async () => {
				const bucketInfo: BucketInfo = {
					bucketName: 'bucket-1',
					region: 'region-1',
				};
				const headObjectOptions = {
					Bucket: bucketInfo.bucketName,
					Key: inputPath,
				};

				await getPropertiesWrapper({
					path: inputPath,
					options: {
						bucket: bucketInfo,
					},
				});
				expect(headObject).toHaveBeenCalledTimes(1);
				await expect(headObject).toBeLastCalledWithConfigAndInput(
					{
						credentials,
						region: bucketInfo.region,

						userAgentValue: expect.any(String),
					},
					headObjectOptions,
				);
			});
			it('should override bucket in headObject call when bucket is string', async () => {
				await getPropertiesWrapper({
					path: inputPath,
					options: {
						bucket: 'default-bucket',
					},
				});
				expect(headObject).toHaveBeenCalledTimes(1);
				await expect(headObject).toBeLastCalledWithConfigAndInput(
					{
						credentials,
						region,
						userAgentValue: expect.any(String),
					},
					{
						Bucket: bucket,
						Key: inputPath,
					},
				);
			});
		});
	});

	describe('Error cases :  With path', () => {
		afterEach(() => {
			jest.clearAllMocks();
		});
		it('getProperties should return a not found error', async () => {
			mockHeadObject.mockRejectedValueOnce(
				Object.assign(new Error(), {
					$metadata: { httpStatusCode: 404 },
					name: 'NotFound',
				}),
			);
			expect.assertions(3);
			try {
				await getPropertiesWrapper({ path: inputPath });
			} catch (error: any) {
				expect(headObject).toHaveBeenCalledTimes(1);
				await expect(headObject).toBeLastCalledWithConfigAndInput(
					{
						credentials,
						region: 'region',
						userAgentValue: expect.any(String),
					},
					{
						Bucket: 'bucket',
						Key: inputPath,
					},
				);
				expect(error.$metadata.httpStatusCode).toBe(404);
			}
		});
	});
});

describe(`getProperties with path and Expected Bucket Owner`, () => {
	const getPropertiesWrapper = (input: GetPropertiesWithPathInput) =>
		getProperties(Amplify, input);
	beforeAll(() => {
		mockFetchAuthSession.mockResolvedValue({
			credentials,
			identityId: defaultIdentityId,
		});
		mockGetConfig.mockReturnValue({
			Storage: {
				S3: {
					bucket,
					region,
					buckets: { 'default-bucket': { bucketName: bucket, region } },
				},
			},
		});
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should pass expectedBucketOwner to headObject', async () => {
		const path = 'public/expectedbucketowner_test';

		await getPropertiesWrapper({
			path,
			options: {
				expectedBucketOwner: validBucketOwner,
			},
		});

		expect(headObject).toHaveBeenCalledTimes(1);
		await expect(headObject).toBeLastCalledWithConfigAndInput(
			{
				credentials,
				region,
				userAgentValue: expect.any(String),
			},
			{
				Bucket: bucket,
				ExpectedBucketOwner: validBucketOwner,
				Key: path,
			},
		);
	});

	it('headObject should not expose expectedBucketOwner when not provided', async () => {
		const path = 'public/expectedbucketowner_test';

		await getPropertiesWrapper({
			path,
			options: {},
		});

		expect(headObject).toHaveBeenCalledTimes(1);
		await expect(headObject).toBeLastCalledWithConfigAndInput(
			{
				credentials,
				region,
				userAgentValue: expect.any(String),
			},
			{
				Bucket: bucket,
				Key: path,
			},
		);
	});

	it('should throw error on invalid bucket owner id', async () => {
		const path = 'public/expectedbucketowner_test';

		await expect(
			getPropertiesWrapper({
				path,
				options: {
					expectedBucketOwner: invalidBucketOwner,
				},
			}),
		).rejects.toThrow('Invalid AWS account ID was provided.');

		expect(headObject).not.toHaveBeenCalled();
	});
});
